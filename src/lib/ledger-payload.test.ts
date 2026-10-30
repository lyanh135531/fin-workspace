import { describe, expect, it } from "vitest";
import {
  hydrateLedgerRows,
  mergeHydratedLedgerRows,
  type CompactLedgerRow,
} from "@/lib/ledger-payload";

describe("ledger-payload", () => {
  it("hydrates compact rows with default fields and resolves base + extra lookups", () => {
    const rows: CompactLedgerRow[] = [
      {
        id: "tx-1",
        amount: "150000",
        type: "expense",
        date: "2026-10-30",
        walletId: "w-main",
        categoryId: "cat-food",
        memberId: "m-1",
        canEdit: true,
      },
      {
        id: "tx-2",
        amount: "2000000",
        type: "transfer",
        purpose: "credit_card_payment",
        status: "pending",
        description: "Thanh toán sao kê T10",
        date: "2026-10-29",
        walletId: "w-card-archived",
        toWalletId: "w-main",
        categoryId: "cat-archived",
        memberId: "m-2",
        isRecurring: true,
        paymentSources: [{ walletId: "w-main", amount: "2000000" }],
        pendingChange: {
          id: "cr-1",
          action: "update",
          requester: "Lan",
          reason: "Sai ngày",
          details: [
            {
              label: "Ngày",
              previous: "28/10/2026",
              proposed: "29/10/2026",
            },
          ],
        },
      },
    ];

    const hydrated = hydrateLedgerRows(
      {
        rows,
        lookups: {
          extraWallets: { "w-card-archived": "Thẻ VIB cũ" },
          extraCategories: {
            "cat-archived": {
              name: "Danh mục đã ẩn",
              color: "#64748b",
              icon: "archive",
            },
          },
          members: {
            "m-1": "Minh",
            "m-2": "Lan",
          },
        },
      },
      [{ id: "w-main", name: "Vietcombank" }],
      [
        {
          id: "cat-food",
          name: "Ăn uống",
          color: "#ef4444",
          icon: "utensils",
        },
      ],
    );

    expect(hydrated).toHaveLength(2);
    expect(hydrated[0]).toEqual({
      id: "tx-1",
      amount: "150000",
      type: "expense",
      purpose: "standard",
      status: "approved",
      description: null,
      date: "2026-10-30",
      walletId: "w-main",
      toWalletId: null,
      toWallet: null,
      categoryId: "cat-food",
      wallet: "Vietcombank",
      category: {
        name: "Ăn uống",
        color: "#ef4444",
        icon: "utensils",
      },
      member: "Minh",
      canRequestEdit: true,
      canRequestDelete: false,
      hasPendingChange: false,
      pendingChangeRequestId: null,
      pendingChangeAction: null,
      pendingChangeRequester: null,
      pendingChangeReason: null,
      pendingChangeDetails: [],
      isRecurring: false,
      allocations: [],
      paymentSources: [],
    });

    expect(hydrated[1]).toMatchObject({
      id: "tx-2",
      purpose: "credit_card_payment",
      status: "pending",
      description: "Thanh toán sao kê T10",
      wallet: "Thẻ VIB cũ",
      toWallet: "Vietcombank",
      category: {
        name: "Danh mục đã ẩn",
        color: "#64748b",
        icon: "archive",
      },
      member: "Lan",
      canRequestEdit: false,
      canRequestDelete: false,
      hasPendingChange: true,
      pendingChangeRequestId: "cr-1",
      pendingChangeAction: "update",
      pendingChangeRequester: "Lan",
      pendingChangeReason: "Sai ngày",
      isRecurring: true,
      paymentSources: [{ walletId: "w-main", amount: "2000000" }],
    });
  });

  it("merges window rows with pinned rows while deduplicating and preserving intra-day order", () => {
    const windowRows = hydrateLedgerRows(
      {
        rows: [
          {
            id: "sep-newer-created",
            amount: "100",
            type: "expense",
            date: "2026-09-15",
            walletId: "w-1",
            memberId: "m-1",
          },
          {
            id: "sep-older-created",
            amount: "200",
            type: "expense",
            date: "2026-09-15",
            walletId: "w-1",
            memberId: "m-1",
          },
        ],
        lookups: { members: { "m-1": "Minh" } },
      },
      [{ id: "w-1", name: "Tiền mặt" }],
      [],
    );

    const pinnedAndCurrentRows = hydrateLedgerRows(
      {
        rows: [
          {
            id: "nov-scheduled",
            amount: "500",
            type: "expense",
            status: "scheduled",
            date: "2026-11-05",
            walletId: "w-1",
            memberId: "m-1",
          },
          {
            id: "sep-newer-created",
            amount: "100",
            type: "expense",
            date: "2026-09-15",
            walletId: "w-1",
            memberId: "m-1",
          },
        ],
        lookups: { members: { "m-1": "Minh" } },
      },
      [{ id: "w-1", name: "Tiền mặt" }],
      [],
    );

    const merged = mergeHydratedLedgerRows(windowRows, pinnedAndCurrentRows);
    expect(merged.map((item) => item.id)).toEqual([
      "nov-scheduled",
      "sep-newer-created",
      "sep-older-created",
    ]);
  });
});
