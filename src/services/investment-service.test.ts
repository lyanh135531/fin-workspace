import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  deleteGoldPurchaseLot,
  deleteGoldSaleRecord,
  deleteSavingsSettlement,
  updateGoldPurchaseLot,
} from "@/services/investment-service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/date", () => ({
  getBusinessDateInTimeZone: vi.fn(() => "2026-04-20"),
}));

describe("investment-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      prisma.workspaceMember.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "member-1",
      workspaceId: "workspace-1",
      workspace: {
        id: "workspace-1",
        name: "Gia đình",
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
      },
      role: { id: "role-1", name: "Admin" },
    });
  });

  it("replays lots and remaining sales chronologically when undoing a later gold sale", async () => {
    // Kịch bản:
    // 1. Mua Lot 1 ngày 2026-01-10: 2 chỉ @ 10.000.000đ/chỉ (tổng vốn = 20.000.000đ)
    // 2. Bán Sale 1 ngày 2026-02-10 (average_cost): 1 chỉ @ 12.000.000đ/chỉ
    //    -> Giá vốn tại thời điểm bán là 10.000.000đ, lãi = 2.000.000đ. Còn lại 1 chỉ vốn 10.000.000đ.
    // 3. Mua Lot 2 ngày 2026-03-10: 1 chỉ @ 16.000.000đ/chỉ (tổng vốn = 16.000.000đ)
    //    -> Tổng nắm giữ trước Sale 2: 2 chỉ, tổng vốn = 26.000.000đ (BQ 13.000.000đ/chỉ)
    // 4. Bán Sale 2 ngày 2026-04-10 (average_cost): 1 chỉ @ 17.000.000đ/chỉ
    // 5. Hoàn tác Sale 2 -> Sale 1 phải giữ nguyên giá vốn lịch sử 10.000.000đ (không bị trộn giá Lot 2 mua sau)
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      goldSaleRecord: {
        findFirst: vi.fn().mockResolvedValue({
          id: "sale-2",
          workspaceId: "workspace-1",
          holdingId: "holding-1",
          destinationWalletId: "wallet-1",
          ledgerTransactionId: "tx-sale-2",
          quantityChi: new Decimal("1.0000"),
          netProceedsAmount: new Decimal("17000000"),
          deletedAt: null,
          holding: {
            id: "holding-1",
            deletedAt: null,
          },
        }),
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sale-1",
            holdingId: "holding-1",
            costMode: "average_cost",
            purchaseLotId: null,
            saleDate: new Date("2026-02-10T00:00:00.000Z"),
            createdAt: new Date("2026-02-10T08:00:00.000Z"),
            quantityChi: new Decimal("1.0000"),
            sellPricePerChi: new Decimal("12000000"),
            feeOrDeductionAmount: new Decimal("0"),
          },
        ]),
      },
      wallet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "wallet-1",
          name: "Ví chính",
          status: "active",
          deletedAt: null,
          currentBalance: new Decimal("50000000"),
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: "wallet-1",
          name: "Ví chính",
          status: "active",
          deletedAt: null,
          currentBalance: new Decimal("50000000"),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      goldPurchaseLot: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "lot-1",
            holdingId: "holding-1",
            purchaseDate: new Date("2026-01-10T00:00:00.000Z"),
            createdAt: new Date("2026-01-10T08:00:00.000Z"),
            quantityChi: new Decimal("2.0000"),
            remainingQuantityChi: new Decimal("0.0000"),
            unitPricePerChi: new Decimal("10000000"),
            totalCostAmount: new Decimal("20000000"),
            remainingCostAmount: new Decimal("0"),
          },
          {
            id: "lot-2",
            holdingId: "holding-1",
            purchaseDate: new Date("2026-03-10T00:00:00.000Z"),
            createdAt: new Date("2026-03-10T08:00:00.000Z"),
            quantityChi: new Decimal("1.0000"),
            remainingQuantityChi: new Decimal("1.0000"),
            unitPricePerChi: new Decimal("16000000"),
            totalCostAmount: new Decimal("16000000"),
            remainingCostAmount: new Decimal("16000000"),
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      goldHolding: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (client: typeof tx) => unknown) => cb(tx),
    );

    await deleteGoldSaleRecord("user-1", "workspace-1", "sale-2");

    // Kiểm tra Sale 1 giữ nguyên giá vốn lịch sử 10.000.000đ và lãi 2.000.000đ
    const sale1UpdateCall = tx.goldSaleRecord.update.mock.calls.find(
      (call) => call[0].where.id === "sale-1",
    );
    expect(sale1UpdateCall).toBeDefined();
    expect(
      sale1UpdateCall?.[0].data.costBasisAllocatedAmount.toFixed(0),
    ).toBe("10000000");
    expect(sale1UpdateCall?.[0].data.realizedProfitAmount.toFixed(0)).toBe(
      "2000000",
    );

    // Kiểm tra số lượng còn lại từng lô: Lot 1 còn 1 chỉ (10tr), Lot 2 còn 1 chỉ (16tr)
    const lot1Update = tx.goldPurchaseLot.update.mock.calls.find(
      (call) => call[0].where.id === "lot-1",
    );
    const lot2Update = tx.goldPurchaseLot.update.mock.calls.find(
      (call) => call[0].where.id === "lot-2",
    );
    expect(lot1Update?.[0].data.remainingQuantityChi.toFixed(4)).toBe("1.0000");
    expect(lot1Update?.[0].data.remainingCostAmount.toFixed(0)).toBe(
      "10000000",
    );
    expect(lot2Update?.[0].data.remainingQuantityChi.toFixed(4)).toBe("1.0000");
    expect(lot2Update?.[0].data.remainingCostAmount.toFixed(0)).toBe(
      "16000000",
    );

    // Kiểm tra tổng vị thế sau khi hoàn tác Sale 2: 2 chỉ, tổng vốn 26.000.000đ, lãi đã chốt 2.000.000đ
    const holdingUpdate = tx.goldHolding.update.mock.calls[0]?.[0];
    expect(holdingUpdate?.data.totalQuantityChi.toFixed(4)).toBe("2.0000");
    expect(holdingUpdate?.data.totalCostBasisAmount.toFixed(0)).toBe(
      "26000000",
    );
    expect(holdingUpdate?.data.realizedProfitAmount.toFixed(0)).toBe("2000000");
  });

  it("blocks balance reversal when the linked source wallet is deactivated or deleted", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      goldPurchaseLot: {
        findFirst: vi.fn().mockResolvedValue({
          id: "lot-1",
          workspaceId: "workspace-1",
          holdingId: "holding-1",
          fundingMode: "from_wallet",
          sourceWalletId: "wallet-inactive",
          ledgerTransactionId: "tx-1",
          quantityChi: new Decimal("1.0000"),
          remainingQuantityChi: new Decimal("1.0000"),
          totalCostAmount: new Decimal("15000000"),
          holding: {
            id: "holding-1",
            deletedAt: null,
            totalQuantityChi: new Decimal("1.0000"),
            totalCostBasisAmount: new Decimal("15000000"),
            saleRecords: [],
          },
        }),
        update: vi.fn(),
      },
      wallet: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (client: typeof tx) => unknown) => cb(tx),
    );

    await expect(
      deleteGoldPurchaseLot("user-1", "workspace-1", "lot-1"),
    ).rejects.toThrow(
      "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
    );
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.goldPurchaseLot.update).not.toHaveBeenCalled();
  });

  it("recreates ledger transaction in updateGoldPurchaseLot when existing ledger transaction was soft-deleted", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      goldPurchaseLot: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000001",
          workspaceId: "workspace-1",
          holdingId: "holding-1",
          fundingMode: "from_wallet",
          sourceWalletId: "00000000-0000-4000-8000-000000000010",
          ledgerTransactionId: "tx-deleted",
          quantityChi: new Decimal("1.0000"),
          remainingQuantityChi: new Decimal("1.0000"),
          unitPricePerChi: new Decimal("14000000"),
          craftingFeeAmount: new Decimal("0"),
          totalCostAmount: new Decimal("14000000"),
          remainingCostAmount: new Decimal("14000000"),
          holding: {
            id: "holding-1",
            name: "Nhẫn tròn BTMC",
            deletedAt: null,
            saleRecords: [],
          },
        }),
        update: vi.fn().mockImplementation(async ({ data }) => ({
          id: "00000000-0000-4000-8000-000000000001",
          ...data,
        })),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "00000000-0000-4000-8000-000000000001",
            remainingQuantityChi: new Decimal("2.0000"),
            remainingCostAmount: new Decimal("28000000"),
          },
        ]),
      },
      wallet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000010",
          name: "Ví chính",
          status: "active",
          deletedAt: null,
          currentBalance: new Decimal("50000000"),
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000010",
          name: "Ví chính",
          status: "active",
          deletedAt: null,
          currentBalance: new Decimal("50000000"),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      workspaceWallet: {
        findFirst: vi.fn().mockResolvedValue({
          wallet: {
            id: "00000000-0000-4000-8000-000000000010",
            name: "Ví chính",
            status: "active",
            kind: "asset",
            deletedAt: null,
            currentBalance: new Decimal("64000000"),
          },
        }),
      },
      transaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "tx-recreated" }),
      },
      goldHolding: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (client: typeof tx) => unknown) => cb(tx),
    );

    const updated = await updateGoldPurchaseLot("user-1", "workspace-1", {
      lotId: "00000000-0000-4000-8000-000000000001",
      fundingMode: "from_wallet",
      sourceWalletId: "00000000-0000-4000-8000-000000000010",
      purchaseDate: "2026-04-15",
      quantityChi: "2",
      unitPricePerChi: "14000000",
      craftingFeeAmount: "0",
    });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-deleted", deletedAt: null },
      }),
    );
    expect(tx.transaction.create).toHaveBeenCalledTimes(1);
    expect(updated.ledgerTransactionId).toBe("tx-recreated");
  });

  it("matches exact settlementId audit log and enforces createdAt desc LIFO order in deleteSavingsSettlement", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      savingsDepositSettlement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "settle-2",
          workspaceId: "workspace-1",
          settlementType: "rollover",
          settlementDate: new Date("2026-04-10T00:00:00.000Z"),
          destinationWalletId: null,
          ledgerTransactionId: null,
          principalWithdrawnAmount: new Decimal("0"),
          interestReceivedAmount: new Decimal("3000000"),
          totalReceivedAmount: new Decimal("0"),
          deposit: {
            id: "deposit-1",
            deletedAt: null,
            principalAmount: new Decimal("100000000"),
            currentPrincipalAmount: new Decimal("83000000"),
            annualInterestRate: new Decimal("6.0"),
            nonTermInterestRate: new Decimal("0.1"),
            termMonths: 6,
            startDate: new Date("2026-04-10T00:00:00.000Z"),
            maturityDate: new Date("2026-10-10T00:00:00.000Z"),
            totalInterestReceived: new Decimal("5000000"),
            settlements: [
              {
                id: "settle-2",
                settlementDate: new Date("2026-04-10T00:00:00.000Z"),
                createdAt: new Date("2026-04-10T10:00:00.000Z"),
              },
              {
                id: "settle-1",
                settlementDate: new Date("2026-04-10T00:00:00.000Z"),
                createdAt: new Date("2026-04-10T09:00:00.000Z"),
              },
            ],
          },
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "log-other",
            metadata: {
              settlementId: "settle-other",
              settlementType: "rollover",
              previousPrincipal: "100000000",
            },
          },
          {
            id: "log-target",
            metadata: {
              settlementId: "settle-2",
              settlementType: "rollover",
              previousPrincipal: "80000000",
              previousAnnualRate: "5.5",
              previousTermMonths: 6,
              previousStartDate: "2025-10-10",
              previousMaturityDate: "2026-04-10",
            },
          },
        ]),
        create: vi.fn().mockResolvedValue({}),
      },
      savingsDeposit: {
        update: vi.fn().mockImplementation(async ({ data }) => data),
      },
    };

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (client: typeof tx) => unknown) => cb(tx),
    );

    await deleteSavingsSettlement("user-1", "workspace-1", "settle-2");

    expect(tx.savingsDepositSettlement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          deposit: {
            include: {
              settlements: {
                orderBy: [{ createdAt: "desc" }, { settlementDate: "desc" }],
              },
            },
          },
        },
      }),
    );

    const updateData = tx.savingsDeposit.update.mock.calls[0]?.[0].data;
    expect(updateData.currentPrincipalAmount.toFixed(0)).toBe("80000000");
    expect(updateData.annualInterestRate.toFixed(1)).toBe("5.5");
  });
});
