import type { JsonWebKey } from "node:crypto";
import Decimal from "decimal.js";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { isAdminRole } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import {
  getBusinessDateInTimeZone,
  getBusinessNotificationRange,
  shiftIsoDate,
} from "@/lib/date";
import { formatAmount } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  generateVapidKeyPair,
  sendWebPushMessage,
  validatePushEndpoint,
  type VapidKeyPair,
} from "@/lib/web-push";
import { generateWorkspaceCreditCardStatements } from "@/services/credit-card-statement-service";

export const BILL_ALERT_REMINDER_MINUTES = 9 * 60; // 09:00
export const BILL_ALERT_LOOKAHEAD_DAYS = 3;
export const NOON_REMINDER_MINUTES = 12 * 60 + 30; // 12:30
export const EVENING_REMINDER_MINUTES = 21 * 60; // 21:00

export type StatementDueAlertItem = {
  id: string;
  cardWalletId: string;
  cardName: string;
  cycleEndDate: string;
  dueDate: string;
  daysUntilDue: number;
  remainingAmount: string;
  totalAmount: string;
  fundingWalletName: string;
  fundingShortfall: boolean;
};

export type RecurringDueAlertItem = {
  id: string;
  title: string;
  walletName: string;
  toWalletName: string | null;
  type: "income" | "expense" | "transfer";
  amount: string;
  nextExecutionDate: string;
  daysUntilDue: number;
  alertState: "upcoming" | "failed";
  lastError: string | null;
  walletShortfall: boolean;
  canRunNow: boolean;
};

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
  endpoints: string[];
  vapidPublicKey: string;
  hasLoggedToday: boolean;
  isDismissedToday: boolean;
  activeReminderSlot: "noon" | "evening" | null;
};

let cachedVapidKeys: VapidKeyPair | null = null;

async function listUserPushEndpoints(userId: string): Promise<string[]> {
  if (typeof prisma.userPushSubscription?.findMany !== "function") {
    return [];
  }
  const rows = await prisma.userPushSubscription.findMany({
    where: { userId },
    select: { endpoint: true },
  });
  return Array.isArray(rows) ? rows.map((row) => row.endpoint) : [];
}

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

  const [existingSetting, subscriptionCount, endpoints, vapid] =
    await Promise.all([
      prisma.userReminderSetting.findUnique({ where: { userId } }),
      prisma.userPushSubscription.count({ where: { userId } }),
      listUserPushEndpoints(userId),
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
    endpoints,
    vapidPublicKey: vapid.publicKey,
    hasLoggedToday,
    isDismissedToday,
    activeReminderSlot,
  };
}

export async function saveUserPushSubscription(
  userId: string,
  input: unknown,
): Promise<{ subscriptionCount: number; endpoints: string[] }> {
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

  const [subscriptionCount, endpoints] = await Promise.all([
    prisma.userPushSubscription.count({
      where: { userId },
    }),
    listUserPushEndpoints(userId),
  ]);

  return { subscriptionCount, endpoints };
}

export async function removeUserPushSubscription(
  userId: string,
  endpoint: string,
): Promise<{ subscriptionCount: number; endpoints: string[] }> {
  const trimmed = endpoint.trim();
  if (trimmed) {
    await prisma.userPushSubscription.deleteMany({
      where: { userId, endpoint: trimmed },
    });
  }

  const [subscriptionCount, endpoints] = await Promise.all([
    prisma.userPushSubscription.count({
      where: { userId },
    }),
    listUserPushEndpoints(userId),
  ]);

  return { subscriptionCount, endpoints };
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

export function diffIsoDays(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  const utc1 = Date.UTC(y1 || 1970, (m1 || 1) - 1, d1 || 1);
  const utc2 = Date.UTC(y2 || 1970, (m2 || 1) - 1, d2 || 1);
  return Math.round((utc2 - utc1) / 86_400_000);
}

function formatShortDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split("-");
  if (!day || !month) return isoDate;
  return `${day}/${month}`;
}

function formatMoneyPush(amount: string, currency = "VND"): string {
  return `${formatAmount(amount)} ${currency === "VND" ? "₫" : currency}`;
}

export async function getWorkspaceDueBillAlerts(params: {
  workspaceId: string;
  memberId: string;
  isAdmin: boolean;
  timeZone: string;
  now?: Date;
}): Promise<{
  statementAlerts: StatementDueAlertItem[];
  recurringAlerts: RecurringDueAlertItem[];
}> {
  const now = params.now ?? new Date();
  const safeZone = resolveSafeTimeZone(params.timeZone);
  const today = getBusinessDateInTimeZone(safeZone, now);
  const horizonDate = shiftIsoDate(today, BILL_ALERT_LOOKAHEAD_DAYS);
  const horizonDatabaseDate = new Date(`${horizonDate}T00:00:00.000Z`);

  if (typeof generateWorkspaceCreditCardStatements === "function") {
    await generateWorkspaceCreditCardStatements(
      params.workspaceId,
      safeZone,
    ).catch(() => null);
  }

  const [rawStatements, rawRecurring] = await Promise.all([
    typeof prisma.creditCardStatement?.findMany === "function"
      ? prisma.creditCardStatement.findMany({
          where: {
            workspaceId: params.workspaceId,
            status: "issued",
            dueDate: { lte: horizonDatabaseDate },
            card: {
              wallet: {
                status: "active",
                deletedAt: null,
              },
            },
          },
          include: {
            card: {
              include: {
                wallet: { select: { id: true, name: true } },
                defaultFundingWallet: {
                  select: { id: true, name: true, currentBalance: true },
                },
              },
            },
            payments: {
              where: { deletedAt: null, workflowStatus: "approved" },
              select: { amount: true },
            },
          },
          orderBy: [{ dueDate: "asc" }, { cycleEndDate: "desc" }],
          take: 12,
        })
      : Promise.resolve([]),
    typeof prisma.recurringTransaction?.findMany === "function"
      ? prisma.recurringTransaction.findMany({
          where: {
            workspaceId: params.workspaceId,
            deletedAt: null,
            approvalStatus: "approved",
            completedAt: null,
            wallet: {
              status: "active",
              deletedAt: null,
            },
            OR: [
              {
                status: "active",
                nextExecutionDate: { lte: horizonDatabaseDate },
              },
              {
                status: "deactive",
                lastError: { not: null },
              },
            ],
          },
          include: {
            wallet: { select: { id: true, name: true, currentBalance: true } },
            toWallet: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            transactions: {
              where: {
                deletedAt: null,
                recurringPeriod: today.slice(0, 7),
              },
              select: { id: true },
              take: 1,
            },
          },
          orderBy: [{ nextExecutionDate: "asc" }, { updatedAt: "desc" }],
          take: 15,
        })
      : Promise.resolve([]),
  ]);

  const statementAlerts: StatementDueAlertItem[] = [];
  for (const stmt of rawStatements) {
    const totalDec = new Decimal(stmt.totalAmount.toString());
    const paidDec = stmt.payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.amount.toString())),
      new Decimal(0),
    );
    const remainingDec = Decimal.max(totalDec.minus(paidDec), 0);
    if (remainingDec.lte(0)) {
      continue;
    }

    const dueDateIso = stmt.dueDate.toISOString().slice(0, 10);
    const cycleEndIso = stmt.cycleEndDate.toISOString().slice(0, 10);
    const daysUntilDue = diffIsoDays(today, dueDateIso);
    const fundingBalanceDec = new Decimal(
      stmt.card.defaultFundingWallet.currentBalance.toString(),
    );

    statementAlerts.push({
      id: stmt.id,
      cardWalletId: stmt.cardWalletId,
      cardName: stmt.card.wallet.name,
      cycleEndDate: cycleEndIso,
      dueDate: dueDateIso,
      daysUntilDue,
      remainingAmount: remainingDec.toFixed(0),
      totalAmount: totalDec.toFixed(0),
      fundingWalletName: stmt.card.defaultFundingWallet.name,
      fundingShortfall: fundingBalanceDec.lt(remainingDec),
    });
  }

  const recurringAlerts: RecurringDueAlertItem[] = [];
  for (const item of rawRecurring) {
    const nextDateIso = item.nextExecutionDate.toISOString().slice(0, 10);
    const endDateIso = item.endDate
      ? item.endDate.toISOString().slice(0, 10)
      : null;

    if (item.status === "active") {
      if (endDateIso && nextDateIso > endDateIso) {
        continue;
      }
      if (
        nextDateIso.slice(0, 7) === today.slice(0, 7) &&
        item.transactions.length > 0
      ) {
        continue;
      }
    }

    const alertState =
      item.status === "deactive" && item.lastError ? "failed" : "upcoming";
    const daysUntilDue = diffIsoDays(today, nextDateIso);
    const amountDec = new Decimal(item.amount.toString());
    const walletBalanceDec = new Decimal(
      item.wallet.currentBalance.toString(),
    );
    const walletShortfall =
      (item.type === "expense" || item.type === "transfer") &&
      walletBalanceDec.lt(amountDec);
    const canRunNow =
      item.status === "active" &&
      (params.isAdmin || item.createdByMemberId === params.memberId) &&
      nextDateIso.slice(0, 7) <= today.slice(0, 7);

    recurringAlerts.push({
      id: item.id,
      title:
        item.description?.trim() ||
        item.category?.name ||
        (item.type === "transfer"
          ? "Chuyển khoản định kỳ"
          : item.type === "income"
            ? "Khoản thu định kỳ"
            : "Khoản chi định kỳ"),
      walletName: item.wallet.name,
      toWalletName: item.toWallet?.name ?? null,
      type: item.type,
      amount: amountDec.toFixed(0),
      nextExecutionDate: nextDateIso,
      daysUntilDue,
      alertState,
      lastError: item.lastError ?? null,
      walletShortfall,
      canRunNow,
    });
  }

  return { statementAlerts, recurringAlerts };
}

export function buildBillAlertPushPayload(params: {
  today: string;
  currency: string;
  workspaceId?: string;
  statementAlerts: StatementDueAlertItem[];
  recurringAlerts: RecurringDueAlertItem[];
}): {
  title: string;
  body: string;
  url: string;
  tag: string;
} | null {
  const { today, currency, workspaceId, statementAlerts, recurringAlerts } =
    params;
  const encodedWorkspaceId = workspaceId
    ? encodeURIComponent(workspaceId)
    : null;

  if (statementAlerts.length > 0) {
    const first = statementAlerts[0]!;
    const amountText = formatMoneyPush(first.remainingAmount, currency);
    const dueText =
      first.daysUntilDue < 0
        ? `đã quá hạn ${Math.abs(first.daysUntilDue)} ngày`
        : first.daysUntilDue === 0
          ? "đến hạn trong hôm nay"
          : `đến hạn ngày ${formatShortDayMonth(first.dueDate)}`;

    const title =
      first.daysUntilDue <= 0
        ? "Sao kê thẻ tín dụng đến hạn"
        : "Nhắc lịch thanh toán sao kê thẻ";

    const body =
      statementAlerts.length === 1
        ? `Thẻ ${first.cardName} cần thanh toán ${amountText} (${dueText}). Chạm để kiểm tra và thanh toán.`
        : `Thẻ ${first.cardName} (${amountText}) và ${statementAlerts.length - 1} sao kê khác cần thanh toán. Chạm để xem chi tiết.`;

    return {
      title,
      body,
      url: encodedWorkspaceId
        ? `/credit-cards/${first.cardWalletId}?action=pay&workspaceId=${encodedWorkspaceId}`
        : `/credit-cards/${first.cardWalletId}?action=pay`,
      tag: `felix-bill-alert-${today}`,
    };
  }

  if (recurringAlerts.length > 0) {
    const first = recurringAlerts[0]!;
    const amountText = formatMoneyPush(first.amount, currency);
    const recurringUrl = encodedWorkspaceId
      ? `/recurring-transactions?workspaceId=${encodedWorkspaceId}`
      : "/recurring-transactions";

    if (first.alertState === "failed") {
      return {
        title: "Lịch giao dịch định kỳ tạm dừng",
        body: `Khoản định kỳ "${first.title}" (${amountText}) chưa thể tự động thực hiện. Chạm để kiểm tra ví ${first.walletName}.`,
        url: recurringUrl,
        tag: `felix-bill-alert-${today}`,
      };
    }

    const dueText =
      first.daysUntilDue <= 0
        ? "trong hôm nay"
        : first.daysUntilDue === 1
          ? `vào ngày mai (${formatShortDayMonth(first.nextExecutionDate)})`
          : `vào ngày ${formatShortDayMonth(first.nextExecutionDate)}`;

    const body = first.walletShortfall
      ? `"${first.title}" (${amountText}) dự kiến thực hiện ${dueText}, nhưng ví ${first.walletName} hiện chưa đủ số dư.`
      : recurringAlerts.length === 1
        ? `"${first.title}" (${amountText}) sẽ thực hiện ${dueText} tại ví ${first.walletName}.`
        : `"${first.title}" (${amountText}) và ${recurringAlerts.length - 1} lịch định kỳ khác sắp đến kỳ thực hiện.`;

    return {
      title: "Nhắc lịch giao dịch định kỳ",
      body,
      url: recurringUrl,
      tag: `felix-bill-alert-${today}`,
    };
  }

  return null;
}

async function collectUserBillAlertPayload(
  userId: string,
  safeZone: string,
  today: string,
  now: Date,
) {
  if (typeof prisma.workspaceMember?.findMany !== "function") {
    return null;
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      status: "active",
      deletedAt: null,
      workspace: { status: "active", deletedAt: null },
    },
    include: {
      role: { select: { code: true } },
      workspace: { select: { id: true, baseCurrency: true, timeZone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const membership of memberships) {
    const alerts = await getWorkspaceDueBillAlerts({
      workspaceId: membership.workspace.id,
      memberId: membership.id,
      isAdmin: isAdminRole(membership.role.code),
      timeZone: membership.workspace.timeZone || safeZone,
      now,
    });

    const payload = buildBillAlertPushPayload({
      today,
      currency: membership.workspace.baseCurrency,
      workspaceId: membership.workspace.id,
      statementAlerts: alerts.statementAlerts,
      recurringAlerts: alerts.recurringAlerts,
    });

    if (payload) {
      return payload;
    }
  }

  return null;
}

export async function dispatchDueDailyReminders(
  now = new Date(),
): Promise<{ checkedUsers: number; sentNotifications: number }> {
  const settings = await prisma.userReminderSetting.findMany({
    where: {
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
    const currentMinutes = getLocalMinutesInTimeZone(safeZone, now);
    const expiredIds: string[] = [];

    if (
      currentMinutes >= BILL_ALERT_REMINDER_MINUTES &&
      setting.lastBillAlertSentDate !== today
    ) {
      const billPayload = await collectUserBillAlertPayload(
        setting.userId,
        safeZone,
        today,
        now,
      );

      if (billPayload) {
        const claimBill = await prisma.userReminderSetting.updateMany({
          where: {
            id: setting.id,
            OR: [
              { lastBillAlertSentDate: null },
              { lastBillAlertSentDate: { not: today } },
            ],
          },
          data: { lastBillAlertSentDate: today },
        });

        if (claimBill.count > 0) {
          for (const sub of setting.user.pushSubscriptions) {
            try {
              const result = await sendWebPushMessage(
                {
                  endpoint: sub.endpoint,
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
                billPayload,
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
        }
      }
    }

    if (setting.dismissedDate === today) {
      if (expiredIds.length > 0) {
        await prisma.userPushSubscription.deleteMany({
          where: { id: { in: expiredIds } },
        });
      }
      continue;
    }

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

    if (dueSlot) {
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

      if (claimResult.count > 0) {
        const loggedToday = await hasUserLoggedTransactionToday(
          setting.userId,
          safeZone,
          now,
        );
        if (!loggedToday) {
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

          for (const sub of setting.user.pushSubscriptions) {
            if (expiredIds.includes(sub.id)) continue;
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
        }
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
