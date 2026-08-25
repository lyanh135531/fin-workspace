import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(), resolveActiveWorkspaceId: vi.fn(), requireWorkspaceMember: vi.fn(),
  createDraft: vi.fn(), activate: vi.fn(), revalidatePath: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("@/services/active-workspace", () => ({ resolveActiveWorkspaceId: mocks.resolveActiveWorkspaceId }));
vi.mock("@/services/workspace-access", () => ({ requireWorkspaceMember: mocks.requireWorkspaceMember }));
vi.mock("@/services/financial-plan-service", () => ({
  createFinancialPlanDraft: mocks.createDraft,
  updateFinancialPlanDraft: vi.fn(), deleteFinancialPlanDraft: vi.fn(),
  activateFinancialPlan: mocks.activate, updateFinancialPlanDeadline: vi.fn(),
  updateFinancialPlanAllocations: vi.fn(), cancelFinancialPlan: vi.fn(), completeFinancialPlan: vi.fn(),
}));

import { activateFinancialPlanAction, createFinancialPlanDraftAction } from "@/app/dashboard/financial-plans/actions";

const validInput = {
  name: "Quỹ Tết", targetAmount: "100000000", existingGoalAmount: "0", targetMonth: "2027-05",
  percentages: { ESSENTIAL: "55", RESPONSIBILITY: "10", DEVELOPMENT: "10", ENJOYMENT: "10", INVESTMENT: "10", GIVING: "5" },
};

describe("financial plan server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: "10000000-0000-0000-0000-000000000001" } });
    mocks.resolveActiveWorkspaceId.mockResolvedValue("20000000-0000-0000-0000-000000000002");
    mocks.requireWorkspaceMember.mockResolvedValue({ role: { code: "ADMIN" } });
    mocks.createDraft.mockResolvedValue({ id: "30000000-0000-0000-0000-000000000003" });
  });

  it("validates and converts money before calling the service", async () => {
    const result = await createFinancialPlanDraftAction(validInput);
    expect(result).toEqual({ ok: true, id: "30000000-0000-0000-0000-000000000003" });
    expect(mocks.createDraft).toHaveBeenCalledWith(
      "10000000-0000-0000-0000-000000000001",
      "20000000-0000-0000-0000-000000000002",
      expect.objectContaining({ name: "Quỹ Tết" }),
    );
    expect(mocks.createDraft.mock.calls[0][2].targetAmount.toFixed(0)).toBe("100000000");
  });

  it("rejects stale/invalid ratio forms before reaching the service", async () => {
    const result = await createFinancialPlanDraftAction({ ...validInput, percentages: { ...validInput.percentages, GIVING: "4" } });
    expect(result.ok).toBe(false);
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it("enforces admin RBAC and returns concurrency conflicts to the client", async () => {
    mocks.requireWorkspaceMember.mockRejectedValueOnce(new Error("Bạn không có quyền truy cập nhóm tài chính này."));
    const forbidden = await activateFinancialPlanAction("30000000-0000-0000-0000-000000000003");
    expect(forbidden).toEqual({ ok: false, message: "Bạn không có quyền truy cập nhóm tài chính này." });
    expect(mocks.activate).not.toHaveBeenCalled();

    mocks.requireWorkspaceMember.mockResolvedValueOnce({ role: { code: "ADMIN" } });
    mocks.activate.mockRejectedValueOnce(new Error("Workspace đã có một kế hoạch đang hoạt động."));
    const conflict = await activateFinancialPlanAction("30000000-0000-0000-0000-000000000003");
    expect(conflict).toEqual({ ok: false, message: "Workspace đã có một kế hoạch đang hoạt động." });
  });
});
