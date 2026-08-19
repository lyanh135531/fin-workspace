import { describe, expect, it } from "vitest";

import { parsePortalActivitySearchParams } from "@/domain/platform-user/portal-activity-schemas";

describe("portal activity schemas", () => {
  it("normalizes valid filters", () => {
    expect(
      parsePortalActivitySearchParams({
        q: "  felix  ",
        dateFrom: "2026-08-01",
        dateTo: "2026-08-19",
        page: "2",
      }),
    ).toEqual({
      q: "felix",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-19",
      page: 2,
    });
  });

  it("falls back safely for impossible dates and unsafe pages", () => {
    expect(
      parsePortalActivitySearchParams({
        dateFrom: "2026-02-30",
        dateTo: "not-a-date",
        page: "Infinity",
      }),
    ).toEqual({
      q: "",
      dateFrom: undefined,
      dateTo: undefined,
      page: 1,
    });
  });
});
