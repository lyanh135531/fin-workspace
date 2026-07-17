import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { authOptions } from "@/auth";
import { formatAmount } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { DashboardActions, Ledger } from "@/app/dashboard/dashboard-actions";
import { ThemeToggle } from "@/app/theme-toggle";
import { WorkspaceSwitcher } from "@/app/dashboard/workspace-switcher";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { Settings } from "lucide-react";
import { WorkspaceNotifications } from "@/app/dashboard/workspace-notifications";
import { availableCategoryWhere } from "@/services/category-visibility";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const activeWorkspaceId = await resolveActiveWorkspaceId(session.user.id);
  const membership = activeWorkspaceId ? await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId: activeWorkspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    include: { workspace: true, role: true },
  }) : null;
  if (!membership) return <main className="p-8">Không có workspace đang hoạt động.</main>;
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const [walletLinks, categories, transactions, availableWorkspaces] = await Promise.all([
    prisma.workspaceWallet.findMany({ where: { workspaceId: membership.workspaceId, wallet: { status: "active", deletedAt: null } }, include: { wallet: true }, orderBy: { wallet: { name: "asc" } } }),
    prisma.category.findMany({ where: availableCategoryWhere(membership.workspaceId), select: { id: true, name: true, color: true }, orderBy: { sortOrder: "asc" } }),
    prisma.transaction.findMany({
      where: { deletedAt: null, date: { gte: monthStart, lt: nextMonth }, member: { workspaceId: membership.workspaceId } },
      include: { wallet: { select: { name: true } }, category: { select: { name: true, color: true } }, member: { include: { user: { select: { username: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100,
    }),
    prisma.workspaceMember.findMany({
      where: { userId: session.user.id, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
      include: { workspace: { select: { id: true, name: true } }, role: { select: { code: true } } },
      orderBy: { workspace: { name: "asc" } },
    }),
  ]);
  const approved = transactions.filter((item) => item.workflowStatus === "approved");
  const income = approved.filter((item) => item.type === "income").reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const expense = approved.filter((item) => item.type === "expense").reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const pendingCount = transactions.filter((item) => item.workflowStatus === "pending").length;
  const balance = walletLinks.reduce((sum, item) => sum.plus(item.wallet.currentBalance.toString()), new Decimal(0));
  const monthLabel = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(today);
  const ledger = transactions.map((item) => ({ id: item.id, amount: item.amount.toString(), type: item.type, status: item.workflowStatus, description: item.description, date: item.date.toISOString(), wallet: item.wallet.name, category: item.category ? { name: item.category.name, color: item.category.color } : null, member: item.member.user.username }));
  return <div className="app-shell min-h-[100dvh] lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="app-sidebar hidden p-5 lg:block"><div className="mb-8 text-xl font-bold">Sunrise Family</div><div className="sunrise-card mb-7 p-4"><p className="text-xs text-slate-500">Workspace đang mở</p><p className="mt-1 font-semibold">{membership.workspace.name}</p></div><nav className="space-y-1 text-sm"><a className="nav-item" href="#overview">Tổng quan</a><WorkspaceSwitcher currentId={membership.workspaceId} workspaces={availableWorkspaces.map(item=>({id:item.workspace.id,name:item.workspace.name,role:item.role.code}))}/><a className="nav-item" href="#wallets">Ví</a><a className="nav-item" href="/dashboard/join">Tham gia workspace</a><span className="nav-item nav-item-muted">Ngân sách</span><span className="nav-item nav-item-muted">Danh mục</span><span className="nav-item nav-item-muted">Thành viên</span></nav><div className="mt-10 border-t border-[#ece4da] pt-5"><p className="text-sm font-semibold">{session.user.username}</p><p className="text-xs text-slate-500">{membership.role.code}</p></div></aside>
    <main className="min-w-0 p-4 sm:p-6 lg:p-8"><header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-slate-500">Workspace / {monthLabel}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{membership.workspace.name}</h1><p className="mt-1 text-xs text-slate-500">Vai trò: {membership.role.code === "ADMIN" ? "Quản trị viên" : "Thành viên"}</p></div><div className="flex items-center gap-2"><WorkspaceNotifications workspaceId={membership.workspaceId} isAdmin={membership.role.code === "ADMIN"}/><a className="button-secondary icon-button" href="/dashboard/settings" title="Cài đặt workspace" aria-label="Cài đặt workspace"><Settings size={18}/></a><ThemeToggle /><DashboardActions wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name }))} categories={categories} canManageWallets={membership.role.code === "ADMIN"} /></div></header>
      <section id="overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tổng số dư" value={`${formatAmount(balance)} ₫`} note={`${walletLinks.length} ví đang hoạt động`} tone="navy" /><Metric label="Thu nhập" value={`${formatAmount(income)} ₫`} note="Giao dịch đã ghi nhận" tone="income" /><Metric label="Chi tiêu" value={`${formatAmount(expense)} ₫`} note="Giao dịch đã ghi nhận" tone="expense" /><Metric label="Chờ xác nhận" value={`${pendingCount} giao dịch`} note="Sẽ chưa làm thay đổi số dư" tone="pending" /></section>
      <section id="wallets" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{walletLinks.map(({ wallet }) => <article className="sunrise-card p-4" key={wallet.id}><p className="text-sm text-slate-500">{wallet.name}</p><p className="mt-2 text-xl font-semibold">{formatAmount(wallet.currentBalance.toString())} ₫</p><p className="mt-2 text-xs text-slate-500">Số dư hiện tại</p></article>)}</section>
      <section id="transactions" className="sunrise-card mt-6 overflow-hidden"><Ledger transactions={ledger} canApprove={membership.role.code === "ADMIN"} monthLabel={monthLabel} /></section>
    </main>
  </div>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) { return <article className={`metric-card metric-${tone}`}><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-3 text-xs text-slate-500">{note}</p></article>; }
