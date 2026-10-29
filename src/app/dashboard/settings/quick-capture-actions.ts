"use server";

import { revalidatePath } from "next/cache";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { toActionFailure } from "@/lib/server-error";
import {
  createQuickCaptureToken,
  getQuickCaptureSettingsState,
  revokeQuickCaptureToken,
} from "@/services/quick-capture-service";

async function actor() {
  const session = await requireAcceptedLegalSession();
  return session.user.id;
}

function quickCaptureFailure(error: unknown, fallback: string, event: string) {
  return toActionFailure(error, fallback, { event });
}

export async function getQuickCaptureStateAction() {
  try {
    const userId = await actor();
    return {
      ok: true as const,
      data: await getQuickCaptureSettingsState(userId),
    };
  } catch (error) {
    return quickCaptureFailure(
      error,
      "Không thể tải cấu hình ghi nhanh từ biên lai.",
      "quick_capture.state_failed",
    );
  }
}

export async function createQuickCaptureTokenAction(input: unknown) {
  try {
    const userId = await actor();
    const data = await createQuickCaptureToken(userId, input);
    revalidatePath("/", "layout");
    return {
      ok: true as const,
      data,
    };
  } catch (error) {
    return quickCaptureFailure(
      error,
      "Không thể tạo khóa liên kết thiết bị.",
      "quick_capture.token_create_failed",
    );
  }
}

export async function revokeQuickCaptureTokenAction(tokenId: string) {
  try {
    const userId = await actor();
    const data = await revokeQuickCaptureToken(userId, { tokenId });
    revalidatePath("/", "layout");
    return {
      ok: true as const,
      data,
    };
  } catch (error) {
    return quickCaptureFailure(
      error,
      "Không thể thu hồi liên kết thiết bị.",
      "quick_capture.token_revoke_failed",
    );
  }
}
