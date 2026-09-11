import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
});
import { allocateOldestObligations, allocateRefundByFundingWallet } from "@/services/credit-card-ledger";
import Decimal from "decimal.js";

describe("credit card obligation ledger", () => {
  it("uses credits then allocates oldest obligations within each funding wallet", () => {
    const allocations = allocateOldestObligations([
      { id: "old", fundingWalletId: "wallet-a", amount: "100", paid: "0", postedDate: new Date("2026-08-01") },
      { id: "refund", fundingWalletId: "wallet-a", amount: "-30", paid: "0", postedDate: new Date("2026-08-02") },
      { id: "new", fundingWalletId: "wallet-a", amount: "100", paid: "0", postedDate: new Date("2026-09-01") },
    ], [{ walletId: "wallet-a", amount: new Decimal(90) }]);
    expect(allocations.map((item) => [item.obligationEntryId, item.amount.toString()])).toEqual([
      ["old", "70"],
      ["new", "20"],
    ]);
  });

  it("rejects a source that pays more than its assigned obligation", () => {
    expect(() => allocateOldestObligations([
      { id: "a", fundingWalletId: "wallet-a", amount: "10", paid: "0", postedDate: new Date("2026-08-01") },
    ], [{ walletId: "wallet-a", amount: new Decimal(11) }])).toThrow("vượt quá nghĩa vụ");
  });

  it("allocates an independent refund to oldest funding obligations", () => {
    const allocations = allocateRefundByFundingWallet([
      { id: "old", fundingWalletId: "wallet-a", amount: "70", paid: "20", postedDate: new Date("2026-08-01") },
      { id: "new", fundingWalletId: "wallet-b", amount: "80", paid: "0", postedDate: new Date("2026-09-01") },
    ], "wallet-b", new Decimal(90));
    expect([...allocations].map(([walletId, amount]) => [walletId, amount.toString()])).toEqual([
      ["wallet-a", "50"],
      ["wallet-b", "40"],
    ]);
  });

  it("puts a refund above current debt into the default funding wallet", () => {
    const allocations = allocateRefundByFundingWallet([
      { id: "debt", fundingWalletId: "wallet-a", amount: "30", paid: "0", postedDate: new Date("2026-08-01") },
    ], "wallet-default", new Decimal(50));
    expect([...allocations].map(([walletId, amount]) => [walletId, amount.toString()])).toEqual([
      ["wallet-a", "30"],
      ["wallet-default", "20"],
    ]);
  });
});
