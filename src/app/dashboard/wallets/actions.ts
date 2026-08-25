"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import {
  createWalletSchema,
  idSchema,
  reorderWalletsSchema,
  statusSchema,
  updateWalletSchema,
} from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import {
  createWalletForWorkspace,
  reorderWalletsForWorkspace,
  setWalletStatusForWorkspace,
  softDeleteWalletForWorkspace,
  updateWalletForWorkspace,
} from "@/services/wallet-service";

function revalidateWalletViews(workspaceId: string) {
  revalidatePath("/wallets");
  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/overview");
  revalidatePath("/recurring-transactions");
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
}

async function walletActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Vui lòng đăng nhập.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new AppError("FORBIDDEN", "Không có nhóm tài chính đang hoạt động.");
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    select: { workspaceId: true },
  });
  if (!membership) throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập nhóm này.");
  return { userId: session.user.id, workspaceId: membership.workspaceId };
}

export async function createManagedWalletAction(input: unknown) {
  try {
    const actor = await walletActor();
    await createWalletForWorkspace(actor.userId, actor.workspaceId, createWalletSchema.parse(input));
    revalidateWalletViews(actor.workspaceId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể tạo ví." };
  }
}

export async function updateManagedWalletAction(input: unknown) {
  try {
    const actor = await walletActor();
    await updateWalletForWorkspace(actor.userId, actor.workspaceId, updateWalletSchema.parse(input));
    revalidateWalletViews(actor.workspaceId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể cập nhật ví." };
  }
}

export async function reorderManagedWalletsAction(input: unknown) {
  try {
    const actor = await walletActor();
    await reorderWalletsForWorkspace(
      actor.userId,
      actor.workspaceId,
      reorderWalletsSchema.parse(input),
    );
    revalidateWalletViews(actor.workspaceId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Không thể sắp xếp ví.",
    };
  }
}

export async function setManagedWalletStatusAction(input: unknown) {
  try {
    const actor = await walletActor();
    const data = z.object({ walletId: idSchema, status: statusSchema }).parse(input);
    await setWalletStatusForWorkspace(
      actor.userId,
      actor.workspaceId,
      data.walletId,
      data.status,
    );
    revalidateWalletViews(actor.workspaceId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể đổi trạng thái ví." };
  }
}

export async function softDeleteManagedWalletAction(input: unknown) {
  try {
    const actor = await walletActor();
    const data = z.object({
      walletId: idSchema,
      settlementWalletId: idSchema.optional(),
    }).parse(input);
    await softDeleteWalletForWorkspace(
      actor.userId,
      actor.workspaceId,
      data.walletId,
      data.settlementWalletId,
    );
    revalidateWalletViews(actor.workspaceId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không thể xóa ví." };
  }
}
