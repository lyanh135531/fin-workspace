import { describe, expect, it } from "vitest";
import { createCategorySchema } from "@/domain/category/schemas";

const base = {
  name: "Danh mục",
  code: "CUSTOM_CATEGORY",
  color: "#123456",
  icon: "tag",
  sortOrder: 0,
};

describe("category jar schema", () => {
  it("requires a jar for a root expense category", () => {
    const result = createCategorySchema.safeParse({ ...base, type: "expense" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["jarCode"] }));
  });

  it("accepts a root expense category with one of the fixed jars", () => {
    expect(createCategorySchema.parse({ ...base, type: "expense", jarCode: "INVESTMENT" }).jarCode)
      .toBe("INVESTMENT");
  });

  it("rejects a jar on an income category", () => {
    const result = createCategorySchema.safeParse({ ...base, type: "income", jarCode: "ESSENTIAL" });
    expect(result.success).toBe(false);
  });

  it("allows an expense child to inherit its parent jar", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      type: "expense",
      parentId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(true);
  });
});
