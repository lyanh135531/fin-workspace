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
const mockFindManySubs = vi.fn();
const mockDeleteManySubs = vi.fn();
const mockSendWebPush = vi.fn();

const mockFindManyStatements = vi.fn();
const mockFindManyRecurring = vi.fn();
const mockFindManyMemberships = vi.fn();

vi.mock("@/services/credit-card-statement-service", () => ({
  generateWorkspaceCreditCardStatements: vi.fn().mockResolvedValue(undefined),
}));

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
      findMany: (...args: unknown[]) => mockFindManySubs(...args),
      deleteMany: (...args: unknown[]) => mockDeleteManySubs(...args),
    },
    workspaceMember: {
      findMany: (...args: unknown[]) => mockFindManyMemberships(...args),
    },
    creditCardStatement: {
      findMany: (...args: unknown[]) => mockFindManyStatements(...args),
    },
    recurringTransaction: {
      findMany: (...args: unknown[]) => mockFindManyRecurring(...args),
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
  buildBillAlertPushPayload,
  computeActiveReminderSlot,
  diffIsoDays,
  dispatchDueDailyReminders,
  EVENING_REMINDER_MINUTES,
  getLocalMinutesInTimeZone,
  getUserReminderState,
  getWorkspaceDueBillAlerts,
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
    mockFindManySubs.mockResolvedValue([]);
    mockFindManyMemberships.mockResolvedValue([]);
    mockFindManyStatements.mockResolvedValue([]);
    mockFindManyRecurring.mockResolvedValue([]);
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
    mockCountSubs.mockResolvedValue(1);
    mockFindManySubs.mockResolvedValue([
      { endpoint: "https://fcm.googleapis.com/fcm/send/user-1-endpoint" },
    ]);
    mockCountTransactions.mockResolvedValue(0);

    const state = await getUserReminderState(
      "user-1",
      "Asia/Ho_Chi_Minh",
      new Date("2026-10-19T05:35:00.000Z"), // 12:35 ICT
    );

    expect(state.noonEnabled).toBe(true);
    expect(state.eveningEnabled).toBe(true);
    expect(state.endpoints).toEqual([
      "https://fcm.googleapis.com/fcm/send/user-1-endpoint",
    ]);
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
      title: "Nhắc ghi chi tiêu buổi trưa",
      url: "/overview?action=new-transaction",
    });
  });

  it("dispatches 09:00 bill alerts with workspaceId even when noonEnabled and eveningEnabled are false", async () => {
    const morningUtc = new Date("2026-10-20T02:05:00.000Z"); // 09:05 ICT
    mockFindManySettings.mockResolvedValue([
      {
        id: "setting-bill-only",
        userId: "user-bill",
        noonEnabled: false,
        eveningEnabled: false,
        timeZone: "Asia/Ho_Chi_Minh",
        lastBillAlertSentDate: null,
        lastNoonSentDate: null,
        lastEveningSentDate: null,
        dismissedDate: null,
        user: {
          pushSubscriptions: [
            {
              id: "sub-bill",
              endpoint: "https://fcm.googleapis.com/fcm/send/token-bill",
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          ],
        },
      },
    ]);
    mockFindManyMemberships.mockResolvedValue([
      {
        id: "member-ws-2",
        role: { code: "ADMIN" },
        workspace: {
          id: "ws-2",
          baseCurrency: "VND",
          timeZone: "Asia/Ho_Chi_Minh",
        },
      },
    ]);
    mockFindManyRecurring.mockResolvedValue([
      {
        id: "rec-due",
        createdByMemberId: "member-ws-2",
        type: "expense",
        amount: "500000",
        description: "Internet cáp quang",
        status: "active",
        nextExecutionDate: new Date("2026-10-21T00:00:00.000Z"),
        endDate: null,
        lastError: null,
        wallet: {
          id: "wallet-1",
          name: "VCB",
          currentBalance: "1000000",
        },
        toWallet: null,
        category: { id: "cat-1", name: "Tiện ích" },
        transactions: [],
      },
    ]);
    mockUpdateManySettings.mockResolvedValue({ count: 1 });
    mockSendWebPush.mockResolvedValue({ ok: true, status: 201, expired: false });

    const result = await dispatchDueDailyReminders(morningUtc);
    expect(mockFindManySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: {
            status: "active",
            deletedAt: null,
            pushSubscriptions: { some: {} },
          },
        },
      }),
    );
    expect(mockFindManyMemberships).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(result).toEqual({ checkedUsers: 1, sentNotifications: 1 });
    expect(mockSendWebPush.mock.calls[0]?.[1]).toMatchObject({
      title: "Nhắc lịch giao dịch định kỳ",
      url: "/recurring-transactions?workspaceId=ws-2",
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

  it("computes due credit card statements and upcoming/failed recurring bills with shortfall detection", async () => {
    expect(diffIsoDays("2026-10-20", "2026-10-22")).toBe(2);
    expect(diffIsoDays("2026-10-20", "2026-10-20")).toBe(0);
    expect(diffIsoDays("2026-10-20", "2026-10-18")).toBe(-2);

    mockFindManyStatements.mockResolvedValue([
      {
        id: "stmt-1",
        cardWalletId: "card-1",
        cycleEndDate: new Date("2026-10-05T00:00:00.000Z"),
        dueDate: new Date("2026-10-22T00:00:00.000Z"),
        totalAmount: "5000000",
        card: {
          wallet: { id: "card-1", name: "VIB Cash Back" },
          defaultFundingWallet: {
            id: "wallet-1",
            name: "Techcombank",
            currentBalance: "2000000",
          },
        },
        payments: [{ amount: "1000000" }],
      },
    ]);

    mockFindManyRecurring.mockResolvedValue([
      {
        id: "rec-1",
        createdByMemberId: "member-1",
        type: "expense",
        amount: "1500000",
        description: "Tiền điện tháng 10",
        status: "active",
        nextExecutionDate: new Date("2026-10-21T00:00:00.000Z"),
        endDate: null,
        lastError: null,
        wallet: {
          id: "wallet-1",
          name: "Techcombank",
          currentBalance: "1000000",
        },
        toWallet: null,
        category: { id: "cat-1", name: "Hóa đơn" },
        transactions: [],
      },
    ]);

    const alerts = await getWorkspaceDueBillAlerts({
      workspaceId: "ws-1",
      memberId: "member-1",
      isAdmin: true,
      timeZone: "Asia/Ho_Chi_Minh",
      now: new Date("2026-10-20T03:00:00.000Z"), // 2026-10-20 10:00 ICT
    });

    expect(alerts.statementAlerts).toEqual([
      {
        id: "stmt-1",
        cardWalletId: "card-1",
        cycleEndDate: "2026-10-05",
        dueDate: "2026-10-22",
        daysUntilDue: 2,
        remainingAmount: "4000000",
        totalAmount: "5000000",
        fundingWalletName: "Techcombank",
        fundingShortfall: true,
        cardName: "VIB Cash Back",
      },
    ]);

    expect(alerts.recurringAlerts).toEqual([
      {
        id: "rec-1",
        title: "Tiền điện tháng 10",
        walletName: "Techcombank",
        toWalletName: null,
        type: "expense",
        amount: "1500000",
        nextExecutionDate: "2026-10-21",
        daysUntilDue: 1,
        alertState: "upcoming",
        lastError: null,
        walletShortfall: true,
        canRunNow: true,
      },
    ]);

    const pushPayload = buildBillAlertPushPayload({
      today: "2026-10-20",
      currency: "VND",
      workspaceId: "ws-1",
      statementAlerts: alerts.statementAlerts,
      recurringAlerts: alerts.recurringAlerts,
    });

    expect(pushPayload).toMatchObject({
      title: "Nhắc lịch thanh toán sao kê thẻ",
      url: "/credit-cards/card-1?action=pay&workspaceId=ws-1",
    });
    expect(pushPayload?.body).toContain("VIB Cash Back");
    expect(pushPayload?.body).toContain("4.000.000 ₫");
  });
});
