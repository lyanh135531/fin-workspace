"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { idSchema } from "@/domain/common/schemas";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { activeWorkspaceCookie } from "@/services/active-workspace";

export async function selectWorkspaceAction(workspaceId: string) {
  try {
    const session = await requireAcceptedLegalSession();

    const id = idSchema.parse(workspaceId);
    const member = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: id,
        status: "active",
        deletedAt: null,
        workspace: { status: "active", deletedAt: null },
      },
    });
    if (!member) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập nhóm tài chính này.");
    }

    const store = await cookies();
    store.set(activeWorkspaceCookie, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    revalidatePath("/overview");
    revalidatePath("/wallets");
    revalidatePath(`/workspace/${id}`);
    revalidatePath("/settings/workspace");
    return { ok: true as const };
  } catch (error) {
    return toActionFailure(error, "Không thể chuyển nhóm tài chính.", {
      event: "workspace.select_failed",
    });
  }
}
