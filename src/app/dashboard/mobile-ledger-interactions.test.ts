import { describe, expect, it } from "vitest";

import {
  exceededLongPressMoveTolerance,
  getMobileLedgerActions,
} from "@/app/dashboard/mobile-ledger-interactions";

describe("mobile ledger long press", () => {
  it("keeps the gesture active for small finger movement", () => {
    expect(
      exceededLongPressMoveTolerance({ x: 20, y: 20 }, { x: 26, y: 25 }),
    ).toBe(false);
  });

  it("cancels the gesture when movement indicates scrolling", () => {
    expect(
      exceededLongPressMoveTolerance({ x: 20, y: 20 }, { x: 20, y: 40 }),
    ).toBe(true);
  });
});

describe("mobile ledger context actions", () => {
  it("returns actions allowed for an editable pending transaction", () => {
    expect(
      getMobileLedgerActions({
        canApprove: true,
        canEdit: true,
        canDelete: true,
        hasPendingChange: false,
        status: "pending",
      }),
    ).toEqual(["select", "approve", "reject", "edit", "delete"]);
  });

  it("hides edit and delete while a change is pending", () => {
    expect(
      getMobileLedgerActions({
        canApprove: false,
        canEdit: true,
        canDelete: true,
        hasPendingChange: true,
        status: "approved",
      }),
    ).toEqual([]);
  });
});
