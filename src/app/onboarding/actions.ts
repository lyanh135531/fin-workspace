"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { toActionFailure, type PublicErrorCode } from "@/lib/server-error";
import { activeWorkspaceCookie } from "@/services/active-workspace";
import { createInitialWorkspaceForUser } from "@/services/workspace-service";

export type CreatePersonalWorkspaceResult = {
  ok: boolean;
  message: string | null;
  workspaceId?: string;
  code?: PublicErrorCode;
  requestId?: string;
};

export async function createPersonalWorkspaceAction(): Promise<CreatePersonalWorkspaceResult> {
  try {
    const session = await requireAcceptedLegalSession({
      authMessage: "Bạn cần đăng nhập để tiếp tục.",
    });

    const result = await createInitialWorkspaceForUser(session.user.id, {
      name: "Tài chính cá nhân",
      description: "Không gian quản lý tài chính cá nhân",
      baseCurrency: "VND",
      timeZone: "Asia/Ho_Chi_Minh",
    });

    const store = await cookies();
    store.set(activeWorkspaceCookie, result.workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    revalidatePath("/onboarding");
    revalidatePath("/overview");
    revalidatePath("/dashboard");

    return {
      ok: true,
      message: null,
      workspaceId: result.workspace.id,
    };
  } catch (error) {
    return toActionFailure(
      error,
      "Không thể tạo không gian cá nhân. Vui lòng thử lại.",
      { event: "onboarding.workspace_create_failed" },
    );
  }
}
