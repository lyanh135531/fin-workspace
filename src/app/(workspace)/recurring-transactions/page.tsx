import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { RecurringTransactionsManager } from "@/app/dashboard/recurring-transactions/recurring-transactions-manager";
import { isAdminRole } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { PageContainer } from "@/components/base";

export default async function RecurringTransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/dashboard");

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
      workspace: { status: "active", deletedAt: null },
    },
    include: { role: true, workspace: true },
  });
  if (!membership || !isAdminRole(membership.role.code)) redirect("/dashboard");

  const [walletLinks, categories, recurringTransactions] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { status: "active", deletedAt: null } },
      include: { wallet: true },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.category.findMany({
      where: availableCategoryWhere(workspaceId),
      select: { id: true, name: true, color: true, icon: true, parentId: true, type: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.recurringTransaction.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        wallet: { select: { name: true } },
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true } },
        createdBy: { include: { user: { select: { username: true } } } },
        _count: { select: { transactions: { where: { deletedAt: null } } } },
      },
      orderBy: [{ status: "asc" }, { nextExecutionDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <PageContainer className="recurring-transactions-page">
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <RecurringTransactionsManager
          workspace={{
            id: workspaceId,
            name: membership.workspace.name,
            currency: membership.workspace.baseCurrency,
            timeZone: membership.workspace.timeZone,
            businessDate: getBusinessDateInTimeZone(
              membership.workspace.timeZone,
            ),
          }}
          wallets={walletLinks.map(({ wallet }) => ({
            id: wallet.id,
            name: wallet.name,
          }))}
          categories={categories}
          schedules={recurringTransactions.map((item) => ({
            id: item.id,
            walletId: item.walletId,
            toWalletId: item.toWalletId,
            categoryId: item.categoryId,
            type: item.type,
            amount: item.amount.toString(),
            description: item.description,
            dayOfMonth: item.dayOfMonth,
            startDate: item.startDate.toISOString().slice(0, 10),
            endDate: item.endDate?.toISOString().slice(0, 10) ?? null,
            nextExecutionDate: item.nextExecutionDate
              .toISOString()
              .slice(0, 10),
            status: item.status,
            completedAt: item.completedAt?.toISOString() ?? null,
            lastError: item.lastError,
            wallet: item.wallet.name,
            toWallet: item.toWallet?.name ?? null,
            category: item.category,
            createdBy: item.createdBy.user.username,
            occurrenceCount: item._count.transactions,
          }))}
        />
      </div>
    </PageContainer>
  );
}
