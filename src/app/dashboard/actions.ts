"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth";
import { createTransactionSchema, createWalletSchema } from "@/domain";
import { debug } from "@/lib/debug";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/services/transaction-service";
import { approveTransaction } from "@/services/transaction-service";
import { idSchema } from "@/domain/common/schemas";
import { createWalletForWorkspace } from "@/services/wallet-service";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Please sign in.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  const membership = workspaceId ? await prisma.workspaceMember.findFirst({ where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } } }) : null;
  if (!membership) throw new AppError("FORBIDDEN", "No active workspace.");
  return { userId: session.user.id, workspaceId: membership.workspaceId };
}

export async function addWalletAction(input: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await actor(); const wallet = await createWalletForWorkspace(user.userId, user.workspaceId, createWalletSchema.parse(input)); debug("wallet.created", { requestId, walletId: wallet.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); return { ok: true }; }
  catch (error) { debug("wallet.failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to create wallet." }; }
}

export async function addTransactionAction(input: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await actor(); const transaction = await createTransaction(user.userId, user.workspaceId, createTransactionSchema.parse(input)); debug("transaction.created", { requestId, transactionId: transaction.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); return { ok: true }; }
  catch (error) { debug("transaction.failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to create transaction." }; }
}

export async function approveTransactionAction(transactionId: string) {
  const requestId = crypto.randomUUID();
  try { const user = await actor(); const transaction = await approveTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId)); debug("transaction.approved", { requestId, transactionId: transaction.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); return { ok: true }; }
  catch (error) { debug("transaction.approve_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to approve transaction." }; }
}
