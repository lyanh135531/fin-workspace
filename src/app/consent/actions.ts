"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { acceptCurrentLegalDocuments } from "@/services/legal-consent-service";

export async function acceptCurrentLegalDocumentsAction() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError("AUTHENTICATION_REQUIRED", "Phiên đăng nhập đã hết hạn.");
    }
    if (!session.user.profileCompleted) {
      throw new AppError("FORBIDDEN", "Bạn cần hoàn tất hồ sơ trước.");
    }

    await acceptCurrentLegalDocuments(session.user.id);
    return { ok: true as const };
  } catch (error) {
    return toActionFailure(
      error,
      "Chưa lưu được xác nhận. Vui lòng thử lại.",
      { event: "legal.consent_accept_failed" },
    );
  }
}
