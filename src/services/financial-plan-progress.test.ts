import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getFinancialPlanNetBalance } from "./financial-plan-progress";
function client(asset: string, card: string) {
  return {
    workspaceWallet: { findMany: vi.fn().mockResolvedValue([
      {walletId:"cash",wallet:{kind:"asset",currentBalance:new Decimal(asset)}},
      {walletId:"card",wallet:{kind:"credit_card",currentBalance:new Decimal(card)}},
    ]) },
    transaction: {findMany:vi.fn().mockResolvedValue([])},
    creditCardObligationEntry:{findMany:vi.fn().mockResolvedValue([])},
  };
}
describe("automatic plan net money",()=>{
  it("does not change progress when card debt is paid from an asset wallet",async()=>{
    const before = await getFinancialPlanNetBalance(client("40000000","10000000") as unknown as Prisma.TransactionClient,"ws");
    const after = await getFinancialPlanNetBalance(client("34000000","4000000") as unknown as Prisma.TransactionClient,"ws");
    expect(before.toFixed(0)).toBe("30000000");expect(after.eq(before)).toBe(true);
  });
  it("deducts the entire card debt and retains a negative net balance",async()=>{
    const tx=client("5000000","12000000");
    expect((await getFinancialPlanNetBalance(tx as unknown as Prisma.TransactionClient,"ws")).toFixed(0)).toBe("-7000000");
    expect(tx.workspaceWallet.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{workspaceId:"ws",wallet:{deletedAt:null}}}));
  });
  it("reconstructs historical assets and debt including later card payments",async()=>{
    const tx=client("34000000","4000000");
    tx.transaction.findMany.mockResolvedValue([{type:"expense",purpose:"credit_card_payment",amount:new Decimal(6000000),walletId:"card",toWalletId:null,creditCardPaymentSources:[{sourceWalletId:"cash",amount:new Decimal(6000000)}]}]);
    tx.creditCardObligationEntry.findMany.mockResolvedValue([{cardWalletId:"card",amount:new Decimal(10000000),paymentAllocations:[]}]);
    const result=await getFinancialPlanNetBalance(tx as unknown as Prisma.TransactionClient,"ws",new Date("2026-11-01"));
    expect(result.toFixed(0)).toBe("30000000");
    expect(tx.creditCardObligationEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({workspaceId:"ws",effectiveDate:{lt:new Date("2026-11-01")}})}));
  });
  it("reverses later internal transfers without changing historical net money",async()=>{
    const tx=client("150","0");
    tx.workspaceWallet.findMany.mockResolvedValue([
      {walletId:"cash",wallet:{kind:"asset",currentBalance:new Decimal(100)}},
      {walletId:"other",wallet:{kind:"asset",currentBalance:new Decimal(50)}},
    ]);
    tx.transaction.findMany.mockResolvedValue([{type:"transfer",purpose:"standard",amount:new Decimal(50),walletId:"cash",toWalletId:"other",creditCardPaymentSources:[]}]);
    expect((await getFinancialPlanNetBalance(tx as unknown as Prisma.TransactionClient,"ws",new Date("2026-11-01"))).toFixed(0)).toBe("150");
  });
  it("rounds once after aggregation and never inflates available whole VND",async()=>{
    expect((await getFinancialPlanNetBalance(client("1000.9999","0.0001") as unknown as Prisma.TransactionClient,"ws")).toFixed(0)).toBe("1000");
  });
});

