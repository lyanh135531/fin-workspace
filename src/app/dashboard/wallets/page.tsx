import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { CreditCardOverview } from "@/app/dashboard/wallets/credit-card-overview";
import { WalletManagement } from "@/app/dashboard/wallets/wallet-management";
import { PageContainer } from "@/components/base";
import { workspaceCapabilities } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

const ZERO = new Decimal(0);

export default async function WalletsPage() {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
      workspace: { status: "active", deletedAt: null },
    },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/overview");

  const links = await prisma.workspaceWallet.findMany({
    where: { workspaceId, wallet: { deletedAt: null } },
    include: {
      wallet: {
        include: {
          _count: {
            select: {
              sourceTransactions: { where: { deletedAt: null } },
              destinationTransactions: { where: { deletedAt: null } },
              sourceRecurringTransactions: { where: { deletedAt: null, workspaceId } },
              destinationRecurringTransactions: { where: { deletedAt: null, workspaceId } },
            },
          },
          creditCardProfile: {
            include: {
              obligations: {
                include: {
                  fundingWallet: { select: { name: true } },
                  paymentAllocations: { select: { amount: true } },
                },
                orderBy: [{ postedDate: "asc" }, { id: "asc" }],
              },
            },
          },
          sourceTransactions: {
            where: {
              deletedAt: null,
              purpose: { in: ["standard", "credit_card_payment", "credit_card_refund"] },
            },
            include: {
              refundTransactions: {
                where: { deletedAt: null, workflowStatus: { not: "rejected" } },
                select: { amount: true },
              },
              creditCardPaymentReservations: {
                where: { releasedAt: null },
                select: { sourceWalletId: true, amount: true },
              },
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 30,
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
  });

  const totalBalance = links
    .filter(({ wallet }) => wallet.status === "active")
    .reduce(
      (total, { wallet }) => wallet.kind === "credit_card"
        ? total.minus(wallet.currentBalance.toString())
        : total.plus(wallet.currentBalance.toString()),
      ZERO,
    );
  const canManage = workspaceCapabilities(membership.role.code).canManageWallets;
  const cards = links.flatMap(({ wallet }) => {
    const profile = wallet.creditCardProfile;
    if (wallet.kind !== "credit_card" || !profile) return [];
    const pendingByWallet = new Map<string, Decimal>();
    for (const transaction of wallet.sourceTransactions) {
      if (transaction.purpose !== "credit_card_payment" || !["pending", "scheduled"].includes(transaction.workflowStatus)) continue;
      for (const reservation of transaction.creditCardPaymentReservations) {
        pendingByWallet.set(
          reservation.sourceWalletId,
          (pendingByWallet.get(reservation.sourceWalletId) ?? ZERO).plus(reservation.amount.toString()),
        );
      }
    }
    const outstandingByWallet = new Map<string, { walletName: string; amount: Decimal }>();
    for (const obligation of profile.obligations) {
      const paid = obligation.paymentAllocations.reduce((sum, item) => sum.plus(item.amount.toString()), ZERO);
      const current = outstandingByWallet.get(obligation.fundingWalletId)?.amount ?? ZERO;
      outstandingByWallet.set(obligation.fundingWalletId, {
        walletName: obligation.fundingWallet.name,
        amount: current.plus(obligation.amount.toString()).minus(paid),
      });
    }
    const debt = Decimal.max(wallet.currentBalance.toString(), ZERO);
    const pendingPayment = [...pendingByWallet.values()].reduce((sum, amount) => sum.plus(amount), ZERO);
    return [{
      id: wallet.id,
      name: wallet.name,
      debt: debt.toString(),
      creditBalance: Decimal.max(new Decimal(wallet.currentBalance.toString()).negated(), ZERO).toString(),
      limit: profile.creditLimit.toString(),
      availableCredit: new Decimal(profile.creditLimit.toString()).minus(wallet.currentBalance.toString()).toString(),
      pendingPayment: pendingPayment.toString(),
      defaultFundingWalletId: profile.defaultFundingWalletId,
      fundingShares: [...outstandingByWallet.entries()].map(([walletId, item]) => ({
        walletId,
        walletName: item.walletName,
        outstanding: Decimal.max(item.amount.minus(pendingByWallet.get(walletId) ?? ZERO), ZERO).toString(),
      })),
      activities: wallet.sourceTransactions.map((transaction) => ({
        id: transaction.id,
        originalTransactionId: transaction.originalTransactionId,
        purpose: transaction.purpose as "standard" | "credit_card_payment" | "credit_card_refund",
        description: transaction.description,
        amount: transaction.amount.toString(),
        date: transaction.date.toISOString().slice(0, 10),
        status: transaction.workflowStatus,
        refundableAmount: transaction.purpose === "standard"
          ? Decimal.max(
              new Decimal(transaction.amount.toString()).minus(
                transaction.refundTransactions.reduce((sum, refund) => sum.plus(refund.amount.toString()), ZERO),
              ),
              ZERO,
            ).toString()
          : undefined,
      })),
    }];
  });

  return (
    <PageContainer className="wallets-page-container">
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <WalletManagement
          key={links.map(({ wallet, sortOrder }) => `${wallet.id}:${wallet.updatedAt.toISOString()}:${sortOrder}`).join("|")}
          workspace={{ name: membership.workspace.name, currency: membership.workspace.baseCurrency }}
          totalBalance={totalBalance.toString()}
          isAdmin={canManage}
          wallets={links.map(({ wallet }) => ({
            id: wallet.id,
            name: wallet.name,
            description: wallet.description,
            openingBalance: wallet.openingBalance.toString(),
            currentBalance: wallet.currentBalance.toString(),
            status: wallet.status,
            transactionCount: wallet._count.sourceTransactions + wallet._count.destinationTransactions,
            recurringTransactionCount: wallet._count.sourceRecurringTransactions + wallet._count.destinationRecurringTransactions,
            updatedAt: wallet.updatedAt.toISOString(),
            kind: wallet.kind,
          }))}
        />
        <CreditCardOverview
          workspaceId={workspaceId}
          currency={membership.workspace.baseCurrency}
          businessDate={getBusinessDateInTimeZone(membership.workspace.timeZone)}
          cards={cards}
        />
      </div>
    </PageContainer>
  );
}
