"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth";
import { createWalletSchema, updateWalletSchema } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { createWalletForWorkspace, updateWalletForWorkspace } from "@/services/wallet-service";

async function walletActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Vui lòng đăng nhập.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new AppError("FORBIDDEN", "Không có workspace đang hoạt động.");
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    select: { workspaceId: true },
  });
  if (!membership) throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập workspace này.");
  return { userId: session.user.id, workspaceId: membership.workspaceId };
}

export async function createManagedWalletAction(input: unknown) {
  try {
    const actor = await walletActor();
    await createWalletForWorkspace(actor.userId, actor.workspaceId, createWalletSchema.parse(input));
    revalidatePath("/wallets");
    revalidatePath(`/workspace/${actor.workspaceId}`);
    revalidatePath("/overview");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tạo ví." };
  }
}

export async function updateManagedWalletAction(input: unknown) {
  try {
    const actor = await walletActor();
    await updateWalletForWorkspace(actor.userId, actor.workspaceId, updateWalletSchema.parse(input));
    revalidatePath("/wallets");
    revalidatePath(`/workspace/${actor.workspaceId}`);
    revalidatePath("/overview");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể cập nhật ví." };
  }
}
