import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateVapidKeyPair } from "@/lib/web-push";

const mockFindUniqueVapid = vi.fn();
const mockUpsertVapid = vi.fn();
const mockFindUniqueSetting = vi.fn();
const mockUpsertSetting = vi.fn();
const mockFindManySettings = vi.fn();
const mockUpdateManySettings = vi.fn();
const mockCountTransactions = vi.fn();
const mockCountSubs = vi.fn();
const mockDeleteManySubs = vi.fn();
const mockSendWebPush = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    APP_TIME_ZONE: "Asia/Ho_Chi_Minh",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webPushVapidKey: {
      findUnique: (...args: unknown[]) => mockFindUniqueVapid(...args),
      upsert: (...args: unknown[]) => mockUpsertVapid(...args),
    },
    userReminderSetting: {
      findUnique: (...args: unknown[]) => mockFindUniqueSetting(...args),
      upsert: (...args: unknown[]) => mockUpsertSetting(...args),
      findMany: (...args: unknown[]) => mockFindManySettings(...args),
      updateMany: (...args: unknown[]) => mockUpdateManySettings(...args),
    },
    transaction: {
      count: (...args: unknown[]) => mockCountTransactions(...args),
    },
    userPushSubscription: {
      count: (...args: unknown[]) => mockCountSubs(...args),
      deleteMany: (...args: unknown[]) => mockDeleteManySubs(...args),
    },
  },
}));

vi.mock("@/lib/web-push", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/web-push")>();
  return {
    ...actual,
    sendWebPushMessage: (...args: unknown[]) => mockSendWebPush(...args),
  };
});

import {
  computeActiveReminderSlot,
  dispatchDueDailyReminders,
  EVENING_REMINDER_MINUTES,
  getLocalMinutesInTimeZone,
  getUserReminderState,
  NOON_REMINDER_MINUTES,
} from "./reminder-service";

describe("reminder-service smart daily expense reminders", () => {
  const sampleVapid = generateVapidKeyPair();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUniqueVapid.mockResolvedValue({
      id: "default",
      publicKey: sampleVapid.publicKey,
      privateKeyJwk: sampleVapid.privateKeyJwk,
    });
  });

  it("enables 12:30 and 21:00 reminders by default when a user opens the app without existing settings", async () => {
    mockFindUniqueSetting.mockResolvedValue(null);
    mockUpsertSetting.mockResolvedValue({
      id: "setting-default",
      userId: "user-1",
      noonEnabled: true,
      eveningEnabled: true,
      timeZone: "Asia/Ho_Chi_Minh",
      lastNoonSentDate: null,
      lastEveningSentDate: null,
      dismissedDate: null,
    });
    mockCountSubs.mockResolvedValue(0);
    mockCountTransactions.mockResolvedValue(0);

    const state = await getUserReminderState(
      "user-1",
      "Asia/Ho_Chi_Minh",
      new Date("2026-10-19T05:35:00.000Z"), // 12:35 ICT
    );

    expect(state.noonEnabled).toBe(true);
    expect(state.eveningEnabled).toBe(true);
    expect(state.activeReminderSlot).toBe("noon");
    expect(mockUpsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({
          userId: "user-1",
          noonEnabled: true,
          eveningEnabled: true,
        }),
      }),
    );
  });

  it("computes active reminder slot for 12:30 and 21:00 only when no transaction logged today", () => {
    expect(
      computeActiveReminderSlot({
        noonEnabled: true,
        eveningEnabled: true,
        hasLoggedToday: false,
        isDismissedToday: false,
        currentMinutes: NOON_REMINDER_MINUTES - 1,
      }),
    ).toBeNull();

    expect(
      computeActiveReminderSlot({
        noonEnabled: true,
        eveningEnabled: true,
        hasLoggedToday: false,
        isDismissedToday: false,
        currentMinutes: NOON_REMINDER_MINUTES,
      }),
    ).toBe("noon");

    expect(
      computeActiveReminderSlot({
        noonEnabled: true,
        eveningEnabled: true,
        hasLoggedToday: true,
        isDismissedToday: false,
        currentMinutes: NOON_REMINDER_MINUTES + 30,
      }),
    ).toBeNull();

    expect(
      computeActiveReminderSlot({
        noonEnabled: true,
        eveningEnabled: true,
        hasLoggedToday: false,
        isDismissedToday: false,
        currentMinutes: EVENING_REMINDER_MINUTES,
      }),
    ).toBe("evening");

    expect(
      computeActiveReminderSlot({
        noonEnabled: true,
        eveningEnabled: true,
        hasLoggedToday: false,
        isDismissedToday: true,
        currentMinutes: EVENING_REMINDER_MINUTES + 15,
      }),
    ).toBeNull();
  });

  it("computes local minutes in Asia/Ho_Chi_Minh accurately", () => {
    // 05:30 UTC = 12:30 Asia/Ho_Chi_Minh (UTC+7)
    const noonUtc = new Date("2026-10-19T05:30:00.000Z");
    expect(getLocalMinutesInTimeZone("Asia/Ho_Chi_Minh", noonUtc)).toBe(
      12 * 60 + 30,
    );

    // 14:00 UTC = 21:00 Asia/Ho_Chi_Minh (UTC+7)
    const eveningUtc = new Date("2026-10-19T14:00:00.000Z");
    expect(getLocalMinutesInTimeZone("Asia/Ho_Chi_Minh", eveningUtc)).toBe(
      21 * 60,
    );
  });

  it("dispatches Web Push at 12:30 when user has not logged any transaction today", async () => {
    const noonUtc = new Date("2026-10-19T05:35:00.000Z"); // 12:35 ICT
    mockFindManySettings.mockResolvedValue([
      {
        id: "setting-1",
        userId: "user-1",
        noonEnabled: true,
        eveningEnabled: true,
        timeZone: "Asia/Ho_Chi_Minh",
        lastNoonSentDate: null,
        lastEveningSentDate: null,
        dismissedDate: null,
        user: {
          pushSubscriptions: [
            {
              id: "sub-1",
              endpoint: "https://fcm.googleapis.com/fcm/send/token-1",
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          ],
        },
      },
    ]);
    mockUpdateManySettings.mockResolvedValue({ count: 1 });
    mockCountTransactions.mockResolvedValue(0);
    mockSendWebPush.mockResolvedValue({ ok: true, status: 201, expired: false });

    const result = await dispatchDueDailyReminders(noonUtc);
    expect(result).toEqual({ checkedUsers: 1, sentNotifications: 1 });
    expect(mockSendWebPush).toHaveBeenCalledTimes(1);
    expect(mockSendWebPush.mock.calls[0]?.[1]).toMatchObject({
      title: "Nhắc ghi chi tiêu buổi trưa (12:30)",
      url: "/overview?action=new-transaction",
    });
  });

  it("skips sending Web Push when user already logged a transaction today", async () => {
    const eveningUtc = new Date("2026-10-19T14:05:00.000Z"); // 21:05 ICT
    mockFindManySettings.mockResolvedValue([
      {
        id: "setting-1",
        userId: "user-1",
        noonEnabled: true,
        eveningEnabled: true,
        timeZone: "Asia/Ho_Chi_Minh",
        lastNoonSentDate: "2026-10-19",
        lastEveningSentDate: null,
        dismissedDate: null,
        user: {
          pushSubscriptions: [
            {
              id: "sub-1",
              endpoint: "https://fcm.googleapis.com/fcm/send/token-1",
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          ],
        },
      },
    ]);
    mockUpdateManySettings.mockResolvedValue({ count: 1 });
    mockCountTransactions.mockResolvedValue(2); // User already logged 2 transactions today

    const result = await dispatchDueDailyReminders(eveningUtc);
    expect(result).toEqual({ checkedUsers: 1, sentNotifications: 0 });
    expect(mockSendWebPush).not.toHaveBeenCalled();
  });
});
