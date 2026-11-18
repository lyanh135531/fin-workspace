import Decimal from "decimal.js";
import { beforeEach,describe,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({tx:{
  $executeRaw:vi.fn(),financialPlan:{findFirst:vi.fn(),findFirstOrThrow:vi.fn(),update:vi.fn()},
  financialPlanGoal:{findMany:vi.fn(),count:vi.fn(),create:vi.fn()},financialPlanMonth:{findFirst:vi.fn()},
  financialGoalFundingEntry:{aggregate:vi.fn(),create:vi.fn()},auditLog:{create:vi.fn()},
},net:vi.fn(),member:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:async(cb: (tx: typeof m.tx)=>unknown)=>cb(m.tx)}}));
vi.mock("@/services/workspace-access",()=>({requireWorkspaceMember:m.member}));
vi.mock("@/services/financial-plan-progress",()=>({getFinancialPlanNetBalance:m.net}));
import {allocateAutomaticProgress,createFinancialPlanGoal,createFinancialGoalFunding,reviewFinancialGoalFunding,reverseFinancialGoalFunding,getPlanGoalProgressSummary,syncPlanAggregate} from "./financial-goal-service";
function goal(id:string,target:number,order:number,month="2026-12"){return{id,targetAmount:new Decimal(target),sortOrder:order,targetMonth:new Date(month+"-01"),createdAt:new Date("2026-01-01"),status:"active" as const};}
beforeEach(()=>{
 vi.resetAllMocks();m.member.mockResolvedValue({id:"member",role:{code:"ADMIN"},workspace:{timeZone:"Asia/Ho_Chi_Minh"}});
 m.tx.financialPlan.findFirstOrThrow.mockResolvedValue({id:"plan",workspaceId:"ws",status:"active",existingGoalAmount:new Decimal(0),startMonth:new Date("2026-09-01")});
 m.tx.financialPlanMonth.findFirst.mockResolvedValue(null);
 m.tx.financialPlanGoal.findMany.mockResolvedValue([goal("a",100,0),goal("b",100,1)]);
 m.net.mockResolvedValue(new Decimal(150));
});
describe("automatic goal progress",()=>{
 it("allocates a single pool without counting the same money for two goals",()=>{
   const progress=allocateAutomaticProgress([goal("a",100,0),goal("b",100,1)],150);
   expect(progress.get("a")!.toFixed(0)).toBe("100");expect(progress.get("b")!.toFixed(0)).toBe("50");
 });
 it("can decrease after spending, and never uses manual funding or linked wallet totals",async()=>{
   expect((await getPlanGoalProgressSummary(m.tx as never,"plan")).totalProgress.toFixed(0)).toBe("150");
   m.net.mockResolvedValue(new Decimal(80));
   const result=await getPlanGoalProgressSummary(m.tx as never,"plan");
   expect(result.totalProgress.toFixed(0)).toBe("80");expect(result.progressByGoal.get("b")!.toFixed(0)).toBe("0");
   expect(m.tx.financialGoalFundingEntry.aggregate).not.toHaveBeenCalled();
 });
 it("keeps debt shortfalls separate from zero displayed progress",async()=>{
   m.net.mockResolvedValue(new Decimal(-50));const result=await getPlanGoalProgressSummary(m.tx as never,"plan");
   expect(result.netBalance.toFixed(0)).toBe("-50");expect(result.totalProgress.toFixed(0)).toBe("0");
 });
 it("uses a fixed terminal result rather than money from the next plan",async()=>{
   m.tx.financialPlan.findFirstOrThrow.mockResolvedValue({workspaceId:"ws",status:"completed",existingGoalAmount:new Decimal(100)});
   expect((await getPlanGoalProgressSummary(m.tx as never,"plan")).totalProgress.toFixed(0)).toBe("100");
   expect(m.net).not.toHaveBeenCalled();
 });
 it("does not silently extend an overdue deadline when synchronizing goals",async()=>{
   m.tx.financialPlanGoal.findMany.mockResolvedValue([goal("a",100,0,"2026-10")]);
   await syncPlanAggregate(m.tx as never,"plan");
   expect(m.tx.financialPlan.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({targetMonth:new Date("2026-10-01")})}));
 });
 it("rejects goal 21 before changing anything",async()=>{
   m.tx.financialPlan.findFirst.mockResolvedValue({id:"plan",status:"active"});
   m.tx.financialPlanGoal.count.mockResolvedValue(20);
   await expect(createFinancialPlanGoal("user","ws",{planId:"plan",name:"New",targetAmount:new Decimal(100),targetMonth:"2099-12",trackingMode:"manual",existingAmount:new Decimal(0),linkedWalletId:null})).rejects.toThrow("20");
   expect(m.tx.financialPlanGoal.create).not.toHaveBeenCalled();
 });
 it.each([createFinancialGoalFunding,reviewFinancialGoalFunding,reverseFinancialGoalFunding])("disables legacy manual mutations",async(fn)=>{
   await expect(fn("user","ws",{})).rejects.toThrow("tự động");expect(m.tx.financialGoalFundingEntry.create).not.toHaveBeenCalled();
 });
});

