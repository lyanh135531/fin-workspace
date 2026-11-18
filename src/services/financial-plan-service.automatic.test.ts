import Decimal from "decimal.js";
import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>{
 const tx={$executeRaw:vi.fn(),financialPlan:{findFirst:vi.fn(),findFirstOrThrow:vi.fn(),update:vi.fn()},
 financialPlanGoal:{findMany:vi.fn(),updateMany:vi.fn()},financialPlanMonth:{create:vi.fn()},
 financialPlanMonthJar:{createMany:vi.fn()},financialPlanGoalMonth:{create:vi.fn()},planJarAllocation:{deleteMany:vi.fn(),createMany:vi.fn()},auditLog:{create:vi.fn()}};
 return{tx,find:vi.fn(),net:vi.fn(),ledger:vi.fn(),member:vi.fn()};
});
vi.mock("@/lib/prisma",()=>({prisma:{financialPlan:{findFirst:m.find},$transaction:async(cb:(tx:typeof m.tx)=>unknown)=>cb(m.tx)}}));
vi.mock("@/services/workspace-access",()=>({requireWorkspaceMember:m.member}));
vi.mock("@/services/financial-plan-progress",()=>({getFinancialPlanNetBalance:m.net}));
vi.mock("@/services/financial-plan-ledger",()=>({
 getFinancialPlanMonthLedger:m.ledger,
 combinedExpenseByJar:(ledger:{approvedExpenseByJar:Record<string,Decimal>;forecastExpenseByJar:Record<string,Decimal>},forecast:boolean)=>Object.fromEntries(Object.entries(ledger.approvedExpenseByJar).map(([code,value])=>[code,value.plus(forecast?ledger.forecastExpenseByJar[code]:0)])),
}));
import {decimalMap,DEFAULT_PLAN_JAR_PERCENTAGES} from "@/domain/financial-plan/calculator";
import {activateFinancialPlan,catchUpFinancialPlan,getFinancialPlanView,updateFinancialPlanAllocations,updateFinancialPlanDeadline} from "./financial-plan-service";
function fixture(start="2026-11",target="2026-12") {
 return{id:"plan",workspaceId:"ws",name:"Plan",createdByMemberId:"member",status:"active" as "active"|"draft"|"completed",targetAmount:new Decimal(20000000),existingGoalAmount:new Decimal(0),
 startMonth:new Date(start+"-01"),targetMonth:new Date(target+"-01"),activationWorkspaceBalance:new Decimal(0),activatedAt:new Date(start+"-01"),
 workspace:{timeZone:"Asia/Ho_Chi_Minh"},months:[] as Array<{month:Date}>,
 allocations:Object.entries(DEFAULT_PLAN_JAR_PERCENTAGES).map(([jarCode,percentage])=>({jarCode,percentage,effectiveMonth:new Date(start+"-01")}))};
}
function goal(id:string,month:string) {
 return{id,financialPlanId:"plan",name:id,targetAmount:new Decimal(10000000),targetMonth:new Date(month+"-01"),status:"active",
 sortOrder:id==="a"?0:1,createdAt:new Date("2026-01-01"),completedAt:null,cancelledAt:null,deletedAt:null};
}
let plan:ReturnType<typeof fixture>;
beforeEach(()=>{
 vi.resetAllMocks();plan=fixture();
 m.member.mockResolvedValue({id:"member",role:{code:"ADMIN"},workspace:{timeZone:"Asia/Ho_Chi_Minh"}});
 m.find.mockImplementation(async({where})=>where.workspaceId && where.workspaceId!=="ws"?null:plan);
 m.tx.financialPlan.findFirst.mockImplementation(async({where})=>where.status && where.status!==plan.status?null:plan);
 m.tx.financialPlan.findFirstOrThrow.mockImplementation(async()=>plan);
 m.tx.financialPlan.update.mockImplementation(async({data})=>Object.assign(plan,data));
 m.tx.financialPlanGoal.findMany.mockResolvedValue([goal("a","2026-12")]);
 m.net.mockResolvedValue(new Decimal(0));
 m.ledger.mockResolvedValue({approvedIncome:new Decimal(0),forecastIncome:new Decimal(0),approvedExpenseByJar:decimalMap(),forecastExpenseByJar:decimalMap(),
 pendingIncome:new Decimal(0),pendingExpense:new Decimal(0),netInvestmentOutflow:new Decimal(0),forecastNetChange:new Decimal(0),forecastReservedCardExpense:new Decimal(0)});
 m.tx.financialPlanMonth.create.mockImplementation(async({data})=>{const snapshot={id:"snapshot",...data,jars:[]};plan.months.push(snapshot);return snapshot;});
});
describe("automatic financial plan lifecycle",()=>{
 it("uses each goal deadline when reserving money in the first month",async()=>{
  m.tx.financialPlanGoal.findMany.mockResolvedValue([goal("a","2026-11"),goal("b","2026-12")]);
  const view=await getFinancialPlanView("user","ws","plan",new Date("2026-11-18"));
  if(view.status==="draft")throw Error("Expected running plan");
  expect(view.months[0].adjustedRequiredAmount).toBe("15000000");
 });
 it("activates in the current business month even on its last day",async()=>{
  plan.status="draft";
  plan.allocations=plan.allocations.map(row=>({...row,effectiveMonth:new Date("1970-01-01")}));
  m.tx.financialPlanGoal.findMany.mockResolvedValue([]);
  // Activation helper is real and requires at least one draft goal.
  m.tx.financialPlanGoal.findMany.mockResolvedValue([{...goal("a","2026-12"),status:"draft"}]);
  // Aggregate synchronization only reads the last closed month.
  Object.assign(m.tx.financialPlanMonth,{findFirst:vi.fn().mockResolvedValue(null)});
  m.net.mockResolvedValue(new Decimal(3000000));
  await activateFinancialPlan("user","ws","plan",new Date("2026-11-30T16:59:00Z"));
  expect(plan.startMonth.toISOString().slice(0,7)).toBe("2026-11");
  expect(plan.activationWorkspaceBalance.toFixed(0)).toBe("3000000");
 });
 it("updates jar ratios immediately and removes future legacy overrides",async()=>{
  const result=await updateFinancialPlanAllocations("user","ws","plan",DEFAULT_PLAN_JAR_PERCENTAGES,new Date("2026-11-30T16:59:00Z"));
  expect(result.effectiveMonth).toBe("2026-11");
  expect(m.tx.planJarAllocation.createMany.mock.calls[0][0].data).toHaveLength(6);
  expect(m.tx.planJarAllocation.createMany.mock.calls[0][0].data[0].effectiveMonth).toEqual(new Date("2026-11-01"));
  expect(m.tx.planJarAllocation.deleteMany).toHaveBeenCalledWith({where:{financialPlanId:"plan",effectiveMonth:{gt:new Date("2026-11-01")}}});
 });
 it("cannot change a closed month's jar allocation",async()=>{
  plan.months.push({month:new Date("2026-11-01")});
  await expect(updateFinancialPlanAllocations("user","ws","plan",DEFAULT_PLAN_JAR_PERCENTAGES,new Date("2026-11-18"))).rejects.toThrow("đã chốt");
  expect(m.tx.planJarAllocation.createMany).not.toHaveBeenCalled();
 });
 it("rejects foreign workspace ids before performing catchup writes",async()=>{
  await expect(updateFinancialPlanDeadline("user","foreign","plan","2027-01",new Date("2026-12-01"))).rejects.toThrow("Không tìm thấy");
  expect(m.tx.financialPlanMonth.create).not.toHaveBeenCalled();
  expect(m.tx.financialPlan.update).not.toHaveBeenCalled();
 });
 it("closes with historical money rather than the current balance, idempotently",async()=>{
  plan=fixture("2026-10");
  m.net.mockImplementation(async(_tx,_ws,before?:Date)=>new Decimal(before ? (before.toISOString().slice(0,7)==="2026-11"?"5000000":"0") : "50000000"));
  const first=await catchUpFinancialPlan("plan",new Date("2026-11-18"));
  const second=await catchUpFinancialPlan("plan",new Date("2026-11-18"));
  expect(first.closed).toBe(1);expect(second.closed).toBe(0);
  const snapshot=m.tx.financialPlanMonth.create.mock.calls[0][0].data;
  expect(snapshot.calculatorVersion).toBe("2.0.0");expect(snapshot.closedActualGoalAmount.toFixed(0)).toBe("5000000");
  expect(m.tx.financialPlanGoalMonth.create.mock.calls[0][0].data.closingProgress.toFixed(0)).toBe("5000000");
 });
 it("projects only future cash changes, without adding current money twice",async()=>{
  plan.activationWorkspaceBalance=new Decimal(20000000);
  m.net.mockResolvedValue(new Decimal(20000000));
  m.ledger.mockResolvedValue({approvedIncome:new Decimal(0),forecastIncome:new Decimal(10000000),approvedExpenseByJar:decimalMap(),
   forecastExpenseByJar:{...decimalMap(),ESSENTIAL:new Decimal(3000000)},pendingIncome:new Decimal(0),pendingExpense:new Decimal(0),
   netInvestmentOutflow:new Decimal(0),forecastNetChange:new Decimal(7000000),forecastReservedCardExpense:new Decimal(0)});
  const view=await getFinancialPlanView("user","ws","plan",new Date("2026-11-18"));
  if(view.status==="draft")throw Error("Expected active plan");
  expect(view.realizedProgress).toBe("20000000");
  expect(view.projectedEndOfCurrentMonthProgress).toBe("27000000");
  expect(view.projectedEndOfPlanProgress).toBe("34000000");
 });
});



describe("monthly net-balance snapshots",()=>{
 it("does not add month-end stocks together",async()=>{
  plan=fixture("2026-10");
  m.net.mockImplementation(async(_tx,_ws,before?:Date)=>new Decimal(before?.toISOString().slice(0,7)==="2026-11"?"5000000":"10000000"));
  await catchUpFinancialPlan("plan",new Date("2026-12-18"));
  const view=await getFinancialPlanView("user","ws","plan",new Date("2026-12-18"));
  if(view.status==="draft")throw Error("Expected active plan");
  expect(view.realizedProgress).toBe("10000000");
  expect(view.closedSnapshotProgress).toBe("10000000");
  expect(m.tx.financialPlanMonth.create).toHaveBeenCalledTimes(2);
 });
 it("records a negative monthly change without creating a negative stock",async()=>{
  plan=fixture("2026-10");plan.activationWorkspaceBalance=new Decimal(10000000);
  m.net.mockResolvedValue(new Decimal(5000000));
  await catchUpFinancialPlan("plan",new Date("2026-11-18"));
  expect(m.tx.financialPlanMonth.create.mock.calls[0][0].data.closedActualGoalAmount.toFixed(0)).toBe("5000000");
  expect(m.tx.financialPlanGoalMonth.create.mock.calls[0][0].data.actualContribution.toFixed(0)).toBe("-5000000");
 });
});


it("preserves fractional jar percentages when reopening a draft",async()=>{
 plan.status="draft";
 const percentages={...DEFAULT_PLAN_JAR_PERCENTAGES,ESSENTIAL:new Decimal("55.55"),RESPONSIBILITY:new Decimal("9.45")};
 plan.allocations=Object.entries(percentages).map(([jarCode,percentage])=>({jarCode,percentage,effectiveMonth:new Date("1970-01-01")}));
 const view=await getFinancialPlanView("user","ws","plan",new Date("2026-11-18"));
 if(view.status!=="draft")throw Error("Expected draft");
 expect(view.percentages.ESSENTIAL).toBe("55.55");
 expect(view.percentages.RESPONSIBILITY).toBe("9.45");
});
