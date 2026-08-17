"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { authOptions } from "@/auth";
import { AppError } from "@/lib/errors";
import { activeWorkspaceCookie } from "@/services/active-workspace";
import { createInitialWorkspaceForUser } from "@/services/workspace-service";

export type CreatePersonalWorkspaceResult = {
  ok: boolean;
  message: string | null;
  workspaceId?: string;
};

export async function createPersonalWorkspaceAction(): Promise<CreatePersonalWorkspaceResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError("AUTHENTICATION_REQUIRED", "Bạn cần đăng nhập để tiếp tục.");
    }

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
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Không thể tạo không gian cá nhân. Vui lòng thử lại.",
    };
  }
}
