import { describe, expect, it } from "vitest";

import {
  getCategoryFilterIds,
  isDateInRange,
} from "@/app/dashboard/dashboard-ledger-filters";

describe("ledger date filters", () => {
  it("includes every date when the date filter is cleared", () => {
    expect(isDateInRange("2024-01-01", null)).toBe(true);
    expect(isDateInRange("2028-12-31", null)).toBe(true);
  });

  it("includes only dates inside the selected range", () => {
    const range = { from: "2026-08-01", to: "2026-08-31" };
    expect(isDateInRange("2026-08-01", range)).toBe(true);
    expect(isDateInRange("2026-08-31", range)).toBe(true);
    expect(isDateInRange("2026-09-01", range)).toBe(false);
  });
});

describe("ledger category filters", () => {
  const categories = [
    { id: "food", parentId: null },
    { id: "restaurant", parentId: "food" },
    { id: "fine-dining", parentId: "restaurant" },
    { id: "transport", parentId: null },
  ];

  it("includes the selected parent and all of its descendants", () => {
    expect([...getCategoryFilterIds(categories, "food")]).toEqual([
      "food",
      "restaurant",
      "fine-dining",
    ]);
  });

  it("only includes the selected category when it has no children", () => {
    expect([...getCategoryFilterIds(categories, "transport")]).toEqual([
      "transport",
    ]);
  });

  it("returns no category ids when the filter is cleared", () => {
    expect([...getCategoryFilterIds(categories, "")]).toEqual([]);
  });
});
