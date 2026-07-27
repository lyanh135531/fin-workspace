import { describe, expect, it, vi } from "vitest";
import { getBusinessNotificationRange } from "@/lib/date";

vi.mock("@/lib/env", () => ({
  env: {
    APP_TIME_ZONE: "Asia/Ho_Chi_Minh",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  },
}));

describe("business notification range", () => {
  it("uses the workspace month and business day in its configured time zone", () => {
    const range = getBusinessNotificationRange(
      "Asia/Ho_Chi_Minh",
      new Date("2026-08-31T17:30:00.000Z"),
    );

    expect(range.today).toBe("2026-09-01");
    expect(range.currentMonthStart.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.nextMonthStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(range.todayAsDatabaseDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.businessDayStart.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(range.nextBusinessDayStart.toISOString()).toBe("2026-09-01T17:00:00.000Z");
  });

  it("handles the last business day of a month", () => {
    const range = getBusinessNotificationRange(
      "Asia/Ho_Chi_Minh",
      new Date("2026-07-31T10:00:00.000Z"),
    );

    expect(range.today).toBe("2026-07-31");
    expect(range.nextBusinessDayStart.toISOString()).toBe("2026-07-31T17:00:00.000Z");
    expect(range.nextMonthStart.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});
