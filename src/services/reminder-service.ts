import type { JsonWebKey } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getBusinessDateInTimeZone, getBusinessNotificationRange } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  generateVapidKeyPair,
  sendWebPushMessage,
  validatePushEndpoint,
  type VapidKeyPair,
} from "@/lib/web-push";

export const NOON_REMINDER_MINUTES = 12 * 60 + 30; // 12:30
export const EVENING_REMINDER_MINUTES = 21 * 60; // 21:00

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(10).max(2048),
  keys: z.object({
    p256dh: z.string().trim().min(16).max(255),
    auth: z.string().trim().min(16).max(255),
  }),
  userAgent: z.string().trim().max(512).optional(),
});

const reminderSettingsSchema = z.object({
  noonEnabled: z.boolean(),
  eveningEnabled: z.boolean(),
  timeZone: z.string().trim().min(1).max(64).optional(),
});

export type UserReminderState = {
  noonEnabled: boolean;
  eveningEnabled: boolean;
  timeZone: string;
  subscriptionCount: number;
  vapidPublicKey: string;
  hasLoggedToday: boolean;
  isDismissedToday: boolean;
  activeReminderSlot: "noon" | "evening" | null;
};

let cachedVapidKeys: VapidKeyPair | null = null;

export async function getOrCreateVapidKeyPair(): Promise<VapidKeyPair> {
  if (cachedVapidKeys) {
    return cachedVapidKeys;
  }

  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivJwk = process.env.VAPID_PRIVATE_KEY_JWK?.trim();
  if (envPub && envPrivJwk) {
    try {
      const parsedJwk = JSON.parse(envPrivJwk) as JsonWebKey;
      cachedVapidKeys = { publicKey: envPub, privateKeyJwk: parsedJwk };
      return cachedVapidKeys;
    } catch {
      // Fall through to database-backed VAPID keypair.
    }
  }

  const existing = await prisma.webPushVapidKey.findUnique({
    where: { id: "default" },
  });

  if (existing && existing.publicKey && existing.privateKeyJwk) {
    cachedVapidKeys = {
      publicKey: existing.publicKey,
      privateKeyJwk: existing.privateKeyJwk as JsonWebKey,
    };
    return cachedVapidKeys;
  }

  const generated = generateVapidKeyPair();
  const saved = await prisma.webPushVapidKey.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      publicKey: generated.publicKey,
      privateKeyJwk: generated.privateKeyJwk as object,
    },
  });

  cachedVapidKeys = {
    publicKey: saved.publicKey,
    privateKeyJwk: saved.privateKeyJwk as JsonWebKey,
  };
  return cachedVapidKeys;
}

export function getLocalMinutesInTimeZone(timeZone: string, now = new Date()): number {
  let safeZone = timeZone || "Asia/Ho_Chi_Minh";
  try {
    const formatted = formatInTimeZone(now, safeZone, "HH:mm");
    const [hours, minutes] = formatted.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  } catch {
    safeZone = "Asia/Ho_Chi_Minh";
    const formatted = formatInTimeZone(now, safeZone, "HH:mm");
    const [hours, minutes] = formatted.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }
}

export function resolveSafeTimeZone(timeZone?: string | null): string {
  const candidate = timeZone?.trim() || "Asia/Ho_Chi_Minh";
  try {
    formatInTimeZone(new Date(), candidate, "yyyy-MM-dd");
    return candidate;
  } catch {
    return "Asia/Ho_Chi_Minh";
  }
}

export async function hasUserLoggedTransactionToday(
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<boolean> {
  const safeZone = resolveSafeTimeZone(timeZone);
  const range = getBusinessNotificationRange(safeZone, now);

  const count = await prisma.transaction.count({
    where: {
      deletedAt: null,
      workflowStatus: { not: "rejected" },
      recurringTransactionId: null,
      member: {
        userId,
        status: "active",
        deletedAt: null,
        workspace: { status: "active", deletedAt: null },
      },
      OR: [
        { date: range.todayAsDatabaseDate },
        {
          createdAt: {
            gte: range.businessDayStart,
            lt: range.nextBusinessDayStart,
          },
        },
      ],
    },
  });

  return count > 0;
}

export function computeActiveReminderSlot(params: {
  noonEnabled: boolean;
  eveningEnabled: boolean;
  hasLoggedToday: boolean;
  isDismissedToday: boolean;
  currentMinutes: number;
}): "noon" | "evening" | null {
  if (params.hasLoggedToday || params.isDismissedToday) {
    return null;
  }
  if (params.eveningEnabled && params.currentMinutes >= EVENING_REMINDER_MINUTES) {
    return "evening";
  }
  if (params.noonEnabled && params.currentMinutes >= NOON_REMINDER_MINUTES) {
    return "noon";
  }
  return null;
}

export async function getUserReminderState(
  userId: string,
  defaultTimeZone = "Asia/Ho_Chi_Minh",
  now = new Date(),
): Promise<UserReminderState> {
  ensureReminderSchedulerRunning();

  const [existingSetting, subscriptionCount, vapid] = await Promise.all([
    prisma.userReminderSetting.findUnique({ where: { userId } }),
    prisma.userPushSubscription.count({ where: { userId } }),
    getOrCreateVapidKeyPair(),
  ]);

  const timeZone = resolveSafeTimeZone(
    existingSetting?.timeZone ?? defaultTimeZone,
  );
  let setting = existingSetting;
  if (!setting && typeof prisma.userReminderSetting.upsert === "function") {
    setting = await prisma.userReminderSetting
      .upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          noonEnabled: true,
          eveningEnabled: true,
          timeZone,
        },
      })
      .catch(() => null);
  }

  const today = getBusinessDateInTimeZone(timeZone, now);
  const noonEnabled = setting?.noonEnabled ?? true;
  const eveningEnabled = setting?.eveningEnabled ?? true;
  const isDismissedToday = setting?.dismissedDate === today;

  const hasLoggedToday = await hasUserLoggedTransactionToday(userId, timeZone, now);
  const currentMinutes = getLocalMinutesInTimeZone(timeZone, now);

  const activeReminderSlot = computeActiveReminderSlot({
    noonEnabled,
    eveningEnabled,
    hasLoggedToday,
    isDismissedToday,
    currentMinutes,
  });

  return {
    noonEnabled,
    eveningEnabled,
    timeZone,
    subscriptionCount,
    vapidPublicKey: vapid.publicKey,
    hasLoggedToday,
    isDismissedToday,
    activeReminderSlot,
  };
}

export async function saveUserPushSubscription(
  userId: string,
  input: unknown,
): Promise<{ subscriptionCount: number }> {
  ensureReminderSchedulerRunning();

  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Dữ liệu đăng ký thông báo đẩy không hợp lệ.");
  }

  let validatedUrl: URL;
  try {
    validatedUrl = validatePushEndpoint(parsed.data.endpoint);
  } catch (error) {
    throw new AppError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Địa chỉ thông báo đẩy không hợp lệ.",
    );
  }

  const normalizedEndpoint = validatedUrl.toString();

  await prisma.userPushSubscription.upsert({
    where: { endpoint: normalizedEndpoint },
    update: {
      userId,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: parsed.data.userAgent ?? null,
    },
    create: {
      userId,
      endpoint: normalizedEndpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: parsed.data.userAgent ?? null,
    },
  });

  if (typeof prisma.userReminderSetting?.upsert === "function") {
    await prisma.userReminderSetting
      .upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          noonEnabled: true,
          eveningEnabled: true,
          timeZone: resolveSafeTimeZone(),
        },
      })
      .catch(() => null);
  }

  const subscriptionCount = await prisma.userPushSubscription.count({
    where: { userId },
  });

  return { subscriptionCount };
}

export async function removeUserPushSubscription(
  userId: string,
  endpoint: string,
): Promise<{ subscriptionCount: number }> {
  const trimmed = endpoint.trim();
  if (trimmed) {
    await prisma.userPushSubscription.deleteMany({
      where: { userId, endpoint: trimmed },
    });
  }

  const subscriptionCount = await prisma.userPushSubscription.count({
    where: { userId },
  });

  return { subscriptionCount };
}

export async function updateUserReminderSettings(
  userId: string,
  input: unknown,
): Promise<UserReminderState> {
  ensureReminderSchedulerRunning();

  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Cấu hình khung giờ nhắc nhở không hợp lệ.");
  }

  const safeZone = resolveSafeTimeZone(parsed.data.timeZone);

  await prisma.userReminderSetting.upsert({
    where: { userId },
    update: {
      noonEnabled: parsed.data.noonEnabled,
      eveningEnabled: parsed.data.eveningEnabled,
      ...(parsed.data.timeZone ? { timeZone: safeZone } : {}),
    },
    create: {
      userId,
      noonEnabled: parsed.data.noonEnabled,
      eveningEnabled: parsed.data.eveningEnabled,
      timeZone: safeZone,
    },
  });

  return getUserReminderState(userId, safeZone);
}

export async function dismissDailyReminderForToday(
  userId: string,
  defaultTimeZone = "Asia/Ho_Chi_Minh",
  now = new Date(),
): Promise<void> {
  const existing = await prisma.userReminderSetting.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  const safeZone = resolveSafeTimeZone(existing?.timeZone ?? defaultTimeZone);
  const today = getBusinessDateInTimeZone(safeZone, now);

  await prisma.userReminderSetting.upsert({
    where: { userId },
    update: { dismissedDate: today },
    create: {
      userId,
      noonEnabled: true,
      eveningEnabled: true,
      timeZone: safeZone,
      dismissedDate: today,
    },
  });
}

export async function sendTestReminderNotification(
  userId: string,
): Promise<{ sentCount: number }> {
  const [subscriptions, vapid] = await Promise.all([
    prisma.userPushSubscription.findMany({ where: { userId } }),
    getOrCreateVapidKeyPair(),
  ]);

  if (subscriptions.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Thiết bị chưa bật nhận thông báo. Vui lòng bật quyền thông báo trước khi gửi thử.",
    );
  }

  let sentCount = 0;
  const expiredIds: string[] = [];

  for (const sub of subscriptions) {
    try {
      const result = await sendWebPushMessage(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        {
          title: "Thông báo nhắc ghi chi tiêu",
          body: "Thiết bị đã sẵn sàng nhận thông báo. Chạm để mở bảng ghi giao dịch nhanh.",
          url: "/overview?action=new-transaction",
          tag: "felix-test-reminder",
        },
        vapid,
      );
      if (result.ok) {
        sentCount += 1;
      } else if (result.expired) {
        expiredIds.push(sub.id);
      }
    } catch {
      // Ignore individual transport failures and continue to remaining devices.
    }
  }

  if (expiredIds.length > 0) {
    await prisma.userPushSubscription.deleteMany({
      where: { id: { in: expiredIds } },
    });
  }

  if (sentCount === 0) {
    throw new AppError(
      "CONFLICT",
      "Không thể gửi thông báo đến thiết bị. Vui lòng cấp lại quyền thông báo trên trình duyệt.",
    );
  }

  return { sentCount };
}

export async function dispatchDueDailyReminders(
  now = new Date(),
): Promise<{ checkedUsers: number; sentNotifications: number }> {
  const settings = await prisma.userReminderSetting.findMany({
    where: {
      OR: [{ noonEnabled: true }, { eveningEnabled: true }],
      user: {
        status: "active",
        deletedAt: null,
        pushSubscriptions: { some: {} },
      },
    },
    include: {
      user: {
        select: {
          pushSubscriptions: true,
        },
      },
    },
  });

  if (settings.length === 0) {
    return { checkedUsers: 0, sentNotifications: 0 };
  }

  const vapid = await getOrCreateVapidKeyPair();
  let sentNotifications = 0;

  for (const setting of settings) {
    const safeZone = resolveSafeTimeZone(setting.timeZone);
    const today = getBusinessDateInTimeZone(safeZone, now);

    if (setting.dismissedDate === today) {
      continue;
    }

    const currentMinutes = getLocalMinutesInTimeZone(safeZone, now);
    let dueSlot: "noon" | "evening" | null = null;

    if (
      setting.eveningEnabled &&
      currentMinutes >= EVENING_REMINDER_MINUTES &&
      setting.lastEveningSentDate !== today
    ) {
      dueSlot = "evening";
    } else if (
      setting.noonEnabled &&
      currentMinutes >= NOON_REMINDER_MINUTES &&
      currentMinutes < EVENING_REMINDER_MINUTES &&
      setting.lastNoonSentDate !== today
    ) {
      dueSlot = "noon";
    }

    if (!dueSlot) {
      continue;
    }

    const claimResult = await prisma.userReminderSetting.updateMany({
      where:
        dueSlot === "evening"
          ? {
              id: setting.id,
              OR: [
                { lastEveningSentDate: null },
                { lastEveningSentDate: { not: today } },
              ],
            }
          : {
              id: setting.id,
              OR: [
                { lastNoonSentDate: null },
                { lastNoonSentDate: { not: today } },
              ],
            },
      data:
        dueSlot === "evening"
          ? { lastEveningSentDate: today }
          : { lastNoonSentDate: today },
    });

    if (claimResult.count === 0) {
      continue;
    }

    const loggedToday = await hasUserLoggedTransactionToday(
      setting.userId,
      safeZone,
      now,
    );
    if (loggedToday) {
      continue;
    }

    const payload =
      dueSlot === "noon"
        ? {
            title: "Nhắc ghi chi tiêu buổi trưa",
            body: "Bạn có khoản chi nào trong sáng nay chưa? Chạm để ghi nhanh trong vài giây.",
            url: "/overview?action=new-transaction",
            tag: `felix-daily-reminder-${today}-noon`,
          }
        : {
            title: "Nhắc ghi chi tiêu cuối ngày",
            body: "Hôm nay bạn chưa ghi giao dịch nào. Chạm để cập nhật chi tiêu trong ngày.",
            url: "/overview?action=new-transaction",
            tag: `felix-daily-reminder-${today}-evening`,
          };

    const expiredIds: string[] = [];
    for (const sub of setting.user.pushSubscriptions) {
      try {
        const result = await sendWebPushMessage(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload,
          vapid,
        );
        if (result.ok) {
          sentNotifications += 1;
        } else if (result.expired) {
          expiredIds.push(sub.id);
        }
      } catch {
        // Ignore transient network errors per endpoint.
      }
    }

    if (expiredIds.length > 0) {
      await prisma.userPushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
    }
  }

  return {
    checkedUsers: settings.length,
    sentNotifications,
  };
}

const globalForReminderScheduler = globalThis as unknown as {
  __felixReminderSchedulerStarted?: boolean;
};

export function ensureReminderSchedulerRunning(): void {
  if (
    process.env.NODE_ENV === "test" ||
    globalForReminderScheduler.__felixReminderSchedulerStarted
  ) {
    return;
  }

  globalForReminderScheduler.__felixReminderSchedulerStarted = true;
  const interval = setInterval(() => {
    void dispatchDueDailyReminders().catch(() => null);
  }, 60_000);

  if (typeof interval.unref === "function") {
    interval.unref();
  }
}
