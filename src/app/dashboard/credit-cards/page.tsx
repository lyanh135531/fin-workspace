import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { CreditCardOverview } from "@/app/dashboard/wallets/credit-card-overview";
import { CreditCardCreate } from "@/app/dashboard/credit-cards/credit-card-create";
import { PageContainer } from "@/components/base";
import { workspaceCapabilities } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { generateWorkspaceCreditCardStatements } from "@/services/credit-card-statement-service";

const ZERO = new Decimal(0);

export default async function CreditCardsPage() {
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

  await generateWorkspaceCreditCardStatements(
    workspaceId,
    membership.workspace.timeZone,
  );

  const [links, fundingLinks] = await Promise.all([
    prisma.workspaceWallet.findMany({
    where: {
      workspaceId,
      wallet: { kind: "credit_card", deletedAt: null },
    },
    include: {
      wallet: {
        include: {
          creditCardProfile: {
            include: {
              obligations: {
                include: {
                  fundingWallet: { select: { name: true } },
                  paymentAllocations: { select: { amount: true } },
                },
                orderBy: [{ postedDate: "asc" }, { id: "asc" }],
              },
              statements: {
                include: {
                  items: true,
                  payments: {
                    where: {
                      deletedAt: null,
                      workflowStatus: { not: "rejected" },
                    },
                    select: { id: true },
                  },
                },
                orderBy: { cycleEndDate: "desc" },
                take: 24,
              },
              installmentPlans: {
                include: {
                  transaction: { select: { description: true, amount: true } },
                  installments: {
                    include: {
                      statementItems: {
                        include: {
                          statement: { select: { status: true } },
                        },
                      },
                    },
                    orderBy: { installmentNo: "asc" },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
          sourceTransactions: {
            where: {
              deletedAt: null,
              purpose: {
                in: [
                  "standard",
                  "credit_card_payment",
                  "credit_card_refund",
                  "credit_card_installment_fee",
                ],
              },
            },
            include: {
              creditCardPaymentReservations: {
                where: { releasedAt: null },
                select: { sourceWalletId: true, amount: true },
              },
              installmentPlan: { select: { id: true } },
              creditCardObligationEntries: {
                include: {
                  paymentAllocations: { select: { id: true } },
                  statementItems: { select: { id: true } },
                },
              },
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 30,
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.workspaceWallet.findMany({
      where: {
        workspaceId,
        wallet: { kind: "asset", status: "active", deletedAt: null },
      },
      select: { wallet: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
  ]);

  const cards = links.flatMap(({ wallet }) => {
    const profile = wallet.creditCardProfile;
    if (!profile) return [];

    const pendingByWallet = new Map<string, Decimal>();
    for (const transaction of wallet.sourceTransactions) {
      if (
        transaction.purpose !== "credit_card_payment" ||
        !["pending", "scheduled"].includes(transaction.workflowStatus)
      ) continue;
      for (const reservation of transaction.creditCardPaymentReservations) {
        pendingByWallet.set(
          reservation.sourceWalletId,
          (pendingByWallet.get(reservation.sourceWalletId) ?? ZERO).plus(
            reservation.amount.toString(),
          ),
        );
      }
    }

    const outstandingByWallet = new Map<
      string,
      { walletName: string; amount: Decimal }
    >();
    for (const obligation of profile.obligations) {
      const paid = obligation.paymentAllocations.reduce(
        (sum, item) => sum.plus(item.amount.toString()),
        ZERO,
      );
      const current = outstandingByWallet.get(obligation.fundingWalletId)?.amount ?? ZERO;
      outstandingByWallet.set(obligation.fundingWalletId, {
        walletName: obligation.fundingWallet.name,
        amount: current.plus(obligation.amount.toString()).minus(paid),
      });
    }

    const oldestStatement = [...profile.statements]
      .reverse()
      .find((statement) => statement.status === "issued");
    const statementSources = new Map<string, Decimal>();
    for (const item of oldestStatement?.items ?? []) {
      statementSources.set(
        item.fundingWalletId,
        (statementSources.get(item.fundingWalletId) ?? ZERO).plus(
          item.amount.toString(),
        ),
      );
    }

    return [{
      id: wallet.id,
      name: wallet.name,
      debt: Decimal.max(wallet.currentBalance.toString(), ZERO).toString(),
      creditBalance: Decimal.max(
        new Decimal(wallet.currentBalance.toString()).negated(),
        ZERO,
      ).toString(),
      limit: profile.creditLimit.toString(),
      availableCredit: new Decimal(profile.creditLimit.toString())
        .minus(wallet.currentBalance.toString())
        .toString(),
      pendingPayment: [...pendingByWallet.values()]
        .reduce((sum, amount) => sum.plus(amount), ZERO)
        .toString(),
      defaultFundingWalletId: profile.defaultFundingWalletId,
      statementClosingDay: profile.statementClosingDay,
      paymentDueDay: profile.paymentDueDay,
      statement: oldestStatement ? {
        id: oldestStatement.id,
        cycleEndDate: oldestStatement.cycleEndDate.toISOString().slice(0, 10),
        dueDate: oldestStatement.dueDate.toISOString().slice(0, 10),
        amount: oldestStatement.totalAmount.toString(),
        status: oldestStatement.status,
        overdue:
          oldestStatement.dueDate.toISOString().slice(0, 10) <
          getBusinessDateInTimeZone(membership.workspace.timeZone),
        paymentPending: oldestStatement.payments.length > 0,
        sources: [...statementSources.entries()]
          .filter(([, amount]) => amount.gt(0))
          .map(([walletId, amount]) => ({
            walletId,
            amount: amount.toString(),
          })),
      } : null,
      statements: profile.statements.map((statement) => ({
        id: statement.id,
        cycleEndDate: statement.cycleEndDate.toISOString().slice(0, 10),
        dueDate: statement.dueDate.toISOString().slice(0, 10),
        amount: statement.totalAmount.toString(),
        status: statement.status,
      })),
      installmentPlans: profile.installmentPlans.map((plan) => ({
        id: plan.id,
        description: plan.transaction.description,
        principal: plan.transaction.amount.toString(),
        fee: plan.feeAmount.toString(),
        termCount: plan.termCount,
        status: plan.status,
        installments: plan.installments.map((installment) => ({
          number: installment.installmentNo,
          dueDate: installment.dueDate.toISOString().slice(0, 10),
          amount: new Decimal(installment.principalAmount.toString())
            .plus(installment.feeAmount.toString())
            .toString(),
          paid:
            installment.statementItems.length > 0 &&
            installment.statementItems.every(
              (item) => item.statement.status === "paid",
            ),
        })),
      })),
      fundingShares: [...outstandingByWallet.entries()].map(
        ([walletId, item]) => ({
          walletId,
          walletName: item.walletName,
          outstanding: Decimal.max(
            item.amount.minus(pendingByWallet.get(walletId) ?? ZERO),
            ZERO,
          ).toString(),
        }),
      ),
      activities: wallet.sourceTransactions.map((transaction) => ({
        id: transaction.id,
        purpose: transaction.purpose,
        description: transaction.description,
        amount: transaction.amount.toString(),
        date: transaction.date.toISOString().slice(0, 10),
        status: transaction.workflowStatus,
        installmentEligible:
          transaction.purpose === "standard" &&
          transaction.workflowStatus === "approved" &&
          !transaction.installmentPlan &&
          transaction.creditCardObligationEntries.every(
            (entry) =>
              entry.paymentAllocations.length === 0 &&
              entry.statementItems.length === 0,
          ),
        installmentPlanId: transaction.installmentPlan?.id ?? null,
      })),
    }];
  });

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <header className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Thẻ tín dụng
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Tạo thẻ, ghi nhận hoàn tiền, quản lý sao kê, trả góp và thanh toán tại một nơi.
            </p>
          </div>
          <CreditCardCreate
            currency={membership.workspace.baseCurrency}
            canManage={workspaceCapabilities(membership.role.code).canManageWallets}
            fundingWallets={fundingLinks.map(({ wallet }) => wallet)}
          />
        </header>
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
