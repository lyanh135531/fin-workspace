"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { toActionFailure } from "@/lib/server-error";
import {
  dismissDailyReminderForToday,
  getUserReminderState,
  removeUserPushSubscription,
  saveUserPushSubscription,
  sendTestReminderNotification,
  updateUserReminderSettings,
} from "@/services/reminder-service";

async function actor() {
  const session = await requireAcceptedLegalSession();
  return session.user.id;
}

function reminderFailure(error: unknown, fallback: string, event: string) {
  return toActionFailure(error, fallback, { event });
}

export async function getUserReminderStateAction() {
  try {
    const userId = await actor();
    return {
      ok: true as const,
      data: await getUserReminderState(userId),
    };
  } catch (error) {
    return reminderFailure(
      error,
      "Không thể tải cài đặt nhắc nhở.",
      "reminder.state_failed",
    );
  }
}

export async function updateUserReminderSettingsAction(input: unknown) {
  try {
    const userId = await actor();
    const data = await updateUserReminderSettings(userId, input);
    return {
      ok: true as const,
      data,
    };
  } catch (error) {
    return reminderFailure(
      error,
      "Không thể lưu cài đặt nhắc nhở.",
      "reminder.update_failed",
    );
  }
}

export async function saveUserPushSubscriptionAction(input: unknown) {
  try {
    const userId = await actor();
    const result = await saveUserPushSubscription(userId, input);
    return {
      ok: true as const,
      data: result,
    };
  } catch (error) {
    return reminderFailure(
      error,
      "Không thể đăng ký nhận thông báo trên thiết bị này.",
      "reminder.subscribe_failed",
    );
  }
}

export async function removeUserPushSubscriptionAction(endpoint: string) {
  try {
    const userId = await actor();
    const result = await removeUserPushSubscription(userId, endpoint);
    return {
      ok: true as const,
      data: result,
    };
  } catch (error) {
    return reminderFailure(
      error,
      "Không thể tắt thông báo trên thiết bị này.",
      "reminder.unsubscribe_failed",
    );
  }
}

export async function removePushSubscriptionOnLogoutAction(endpoint: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !endpoint?.trim()) {
      return { ok: true as const };
    }
    await removeUserPushSubscription(session.user.id, endpoint);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function sendTestReminderNotificationAction() {
  try {
    const userId = await actor();
    const result = await sendTestReminderNotification(userId);
    return {
      ok: true as const,
      data: result,
    };
  } catch (error) {
    return reminderFailure(
      error,
      "Không thể gửi thông báo thử nghiệm.",
      "reminder.test_failed",
    );
  }
}

export async function dismissDailyReminderAction() {
  try {
    const userId = await actor();
    await dismissDailyReminderForToday(userId);
    return { ok: true as const };
  } catch (error) {
    return reminderFailure(
      error,
      "Không thể cập nhật trạng thái nhắc nhở hôm nay.",
      "reminder.dismiss_failed",
    );
  }
}
