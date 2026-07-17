import type { CreateWalletInput } from "@/domain";
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
