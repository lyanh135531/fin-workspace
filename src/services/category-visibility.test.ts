import { describe, expect, it } from "vitest";
import { availableCategoryWhere, manageableCategoryWhere } from "@/services/category-visibility";

describe("category workspace visibility", () => {
  it("only exposes categories belonging to the active workspace", () => {
    expect(availableCategoryWhere("workspace-a")).toEqual({
      status: "active",
      deletedAt: null,
      workspaceId: "workspace-a",
      type: { not: "investment" },
    });
  });
  it("keeps inactive workspace categories visible for management", () => {
    expect(manageableCategoryWhere("workspace-b")).toEqual({
      deletedAt: null,
      workspaceId: "workspace-b",
      type: { not: "investment" },
    });
  });
});
