import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { shareForImportedInstallment, statementPaymentDetails } from "@/services/credit-card-statement-service";
import type { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/env", () => ({ env: { DATABASE_URL: "postgresql://test", APP_TIME_ZONE: "Asia/Ho_Chi_Minh" } }));

describe("credit card statement payments", () => {
  it("allocates only the remaining imported terms and keeps the final rounding remainder", () => {
    expect(shareForImportedInstallment("100", 12, 8, 9).toFixed(4)).toBe("25.0000");
    expect(shareForImportedInstallment("100.0001", 12, 8, 12).toFixed(4)).toBe("25.0001");
  });

  it("nets credits per funding wallet and allocates only the statement amount", async () => {
    const tx = {
      creditCardStatement: {
        findUnique: vi.fn().mockResolvedValue({
          id: "statement-1",
          items: [
            { obligationEntryId: "purchase-1", fundingWalletId: "wallet-1", amount: new Decimal("100"), createdAt: new Date("2026-09-01") },
            { obligationEntryId: "refund-1", fundingWalletId: "wallet-1", amount: new Decimal("-25"), createdAt: new Date("2026-09-02") },
            { obligationEntryId: "purchase-2", fundingWalletId: "wallet-2", amount: new Decimal("50"), createdAt: new Date("2026-09-03") },
          ],
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await statementPaymentDetails(tx, "statement-1");
    expect(result.dueByWallet.get("wallet-1")?.toString()).toBe("75");
    expect(result.dueByWallet.get("wallet-2")?.toString()).toBe("50");
    expect(result.allocations.get("purchase-1")?.toString()).toBe("75");
    expect(result.allocations.get("purchase-2")?.toString()).toBe("50");
    expect(result.allocations.has("refund-1")).toBe(false);
  });
});
