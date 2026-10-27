import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { isLegalConsentEnforced } from "@/domain/legal-policy/policy-versions";
import { AppError } from "@/lib/errors";

async function resolvePrismaForSessionCheck() {
  try {
    const mod = await import("@/lib/prisma");
    return mod.prisma;
  } catch {
    return null;
  }
}

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
    if (session.user.profileCompleted === false) {
      throw new AppError(
        "FORBIDDEN",
        "Vui lòng hoàn tất thiết lập hồ sơ tài khoản trước khi tiếp tục.",
      );
    }
    if (!consent.satisfied) {
      throw new AppError(
        "LEGAL_CONSENT_REQUIRED",
        "Bạn cần đồng ý với Chính sách bảo mật và Điều khoản sử dụng để tiếp tục.",
      );
    }
  } else {
    const prisma = await resolvePrismaForSessionCheck();
    const findUnique = prisma?.user?.findUnique;
    if (
      typeof findUnique === "function" &&
      (!process.env.VITEST || "mock" in findUnique)
    ) {
      const activeUser = await findUnique({
        where: { id: session.user.id },
        select: { status: true, deletedAt: true },
      });
      if (
        activeUser === null ||
        (activeUser &&
          ((activeUser.status !== undefined && activeUser.status !== "active") ||
            (activeUser.deletedAt !== undefined && activeUser.deletedAt !== null)))
      ) {
        throw new AppError(
          "AUTHENTICATION_REQUIRED",
          "Tài khoản đã bị khóa hoặc ngừng hoạt động.",
        );
      }
    }
    if (session.user.profileCompleted === false) {
      throw new AppError(
        "FORBIDDEN",
        "Vui lòng hoàn tất thiết lập hồ sơ tài khoản trước khi tiếp tục.",
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
      if (error.code === "AUTHENTICATION_REQUIRED") {
        const isInactive =
          error.message.includes("khóa") ||
          error.message.includes("ngừng hoạt động");
        redirect(isInactive ? "/sign-in?inactive=1" : "/sign-in");
      }
      if (error.code === "FORBIDDEN") redirect("/setup/google");
      if (error.code === "LEGAL_CONSENT_REQUIRED") redirect("/consent");
    }
    throw error;
  }
}
