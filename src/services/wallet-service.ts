import type { CreateWalletInput, UpdateWalletInput } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function createWalletForWorkspace(userId: string, workspaceId: string, input: CreateWalletInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.create({ data: { name: input.name, description: input.description, openingBalance: input.openingBalance, currentBalance: input.openingBalance } });
    await tx.workspaceWallet.create({ data: { workspaceId, walletId: wallet.id } });
    return wallet;
  });
}

export async function updateWalletForWorkspace(userId: string, workspaceId: string, input: UpdateWalletInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  const link = await prisma.workspaceWallet.findFirst({
    where: { workspaceId, walletId: input.walletId, wallet: { deletedAt: null } },
    select: { walletId: true },
  });
  if (!link) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Wallet is not available in this workspace.");
  return prisma.wallet.update({
    where: { id: link.walletId },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description || null,
    },
  });
}
