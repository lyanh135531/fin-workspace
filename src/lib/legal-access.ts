import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { isLegalConsentEnforced } from "@/domain/legal-policy/policy-versions";
import { AppError } from "@/lib/errors";

export async function requireAcceptedLegalSession(options: { authMessage?: string } = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      options.authMessage ?? "Vui lòng đăng nhập.",
    );
  }

  if (isLegalConsentEnforced()) {
    const { getLegalConsentStatus } = await import(
      "@/services/legal-consent-service"
    );
    const consent = await getLegalConsentStatus(session.user.id);
    if (!consent.satisfied) {
      throw new AppError(
        "LEGAL_CONSENT_REQUIRED",
        "Bạn cần đồng ý với Chính sách bảo mật và Điều khoản sử dụng để tiếp tục.",
      );
    }
  }

  return session;
}

export async function requireAcceptedLegalPageSession() {
  try {
    return await requireAcceptedLegalSession();
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "AUTHENTICATION_REQUIRED") redirect("/sign-in");
      if (error.code === "LEGAL_CONSENT_REQUIRED") redirect("/consent");
    }
    throw error;
  }
}
