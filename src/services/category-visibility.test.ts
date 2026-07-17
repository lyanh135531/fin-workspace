import { describe, expect, it } from "vitest";
import { availableCategoryWhere, manageableCategoryWhere } from "@/services/category-visibility";

describe("category workspace visibility", () => {
  it("only exposes global categories and categories of the active workspace", () => {
    expect(availableCategoryWhere("workspace-a")).toEqual({ status: "active", deletedAt: null, OR: [{ workspaceId: null }, { workspaceId: "workspace-a" }] });
  });
  it("keeps inactive private categories visible only to their owner workspace for management", () => {
    expect(manageableCategoryWhere("workspace-b")).toEqual({ deletedAt: null, OR: [{ workspaceId: null }, { workspaceId: "workspace-b" }] });
  });
});
