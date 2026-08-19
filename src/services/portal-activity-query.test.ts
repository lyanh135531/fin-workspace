import { describe, expect, it, vi } from "vitest";

import { buildPortalActivityWhere } from "@/services/portal-activity-query";

vi.mock("@/lib/env", () => ({
  env: {
    APP_TIME_ZONE: "Asia/Ho_Chi_Minh",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  },
}));

describe("portal activity query", () => {
  it("filters a local business day without leaking across day boundaries", () => {
    const where = buildPortalActivityWhere({
      q: "",
      dateFrom: "2026-08-19",
      dateTo: "2026-08-19",
    });

    expect(where.createdAt).toEqual({
      gte: new Date("2026-08-18T17:00:00.000Z"),
      lt: new Date("2026-08-19T17:00:00.000Z"),
    });
  });

  it("combines username and one-sided date filters", () => {
    const where = buildPortalActivityWhere({
      q: "felix",
      dateFrom: "2026-08-19",
    });

    expect(where).toEqual({
      actor: {
        username: { contains: "felix", mode: "insensitive" },
      },
      createdAt: {
        gte: new Date("2026-08-18T17:00:00.000Z"),
      },
    });
  });
});
