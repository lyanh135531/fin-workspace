import Link from "next/link";
import { Users, UserCheck, UserX, UserPlus, Flame, ChevronRight } from "lucide-react";

import { Button, Card, PageContainer, PageHeader } from "@/components/base";
import { requirePlatformAdminSession } from "@/services/platform-access";
import {
  getPortalDashboardStats,
  getUserRegistrationsByMonth,
  getSystemActivityByDay,
  getDailyActiveUsers,
  getRecentSystemActivity,
  getTopActiveUsers,
} from "@/services/portal-dashboard-query";
import { env } from "@/lib/env";
import { PortalDashboardCharts } from "./portal-dashboard-charts";
import { formatActionLabel } from "./portal-action-labels";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: env.APP_TIME_ZONE,
});

const statCards = [
  { key: "total" as const, label: "Tổng user", icon: Users, color: "var(--primary)" },
  { key: "active" as const, label: "Đang hoạt động", icon: UserCheck, color: "var(--success)" },
  { key: "deactive" as const, label: "Vô hiệu hóa", icon: UserX, color: "var(--destructive)" },
  { key: "newLast30" as const, label: "Mới (30 ngày)", icon: UserPlus, color: "var(--info, var(--primary))" },
] as const;

export default async function PortalDashboardPage() {
  await requirePlatformAdminSession();

  const [stats, registrations, activityByDay, dau, topUsers, recentActivity] =
    await Promise.all([
      getPortalDashboardStats(),
      getUserRegistrationsByMonth(),
      getSystemActivityByDay(),
      getDailyActiveUsers(),
      getTopActiveUsers(10),
      getRecentSystemActivity(10),
    ]);

  return (
    <PageContainer className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Tổng quan hệ thống"
        description="Thống kê người dùng và hoạt động hệ thống."
        border={false}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.key} size="sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {stat.label}
              </p>
              <div
                className="grid size-8 shrink-0 place-items-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in srgb, ${stat.color} 12%, var(--surface))`,
                  color: stat.color,
                }}
              >
                <stat.icon size={16} strokeWidth={1.8} aria-hidden />
              </div>
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">
              {stats[stat.key].toLocaleString("vi-VN")}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PortalDashboardCharts
          registrations={registrations}
          activityByDay={activityByDay}
          dau={dau}
        />
      </div>

      {/* Top 10 Active Users & Recent Activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Top 10 Active Users */}
        <Card className="gap-0 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                <Flame className="size-4 text-[var(--warning,#f59e0b)]" aria-hidden />
                Top 10 user sử dụng nhiều nhất
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Xếp hạng theo tổng số thao tác
              </p>
            </div>
          </div>

          {topUsers.length === 0 ? (
            <div className="grid min-h-32 place-items-center p-6 text-sm text-[var(--text-muted)]">
              Chưa có dữ liệu người dùng.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {topUsers.map((user, index) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-[color-mix(in_srgb,var(--warning,#f59e0b)_20%,transparent)] text-[var(--warning,#f59e0b)]"
                          : index === 1
                            ? "bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-[var(--primary)]"
                            : index === 2
                              ? "bg-[color-mix(in_srgb,var(--success)_20%,transparent)] text-[var(--success)]"
                              : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/portal/users/${user.id}`}
                        className="truncate text-sm font-semibold text-[var(--foreground)] hover:underline"
                        title={user.username}
                      >
                        {user.username}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">
                        Cuối: {dateTimeFormatter.format(user.lastActive)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-2 py-0.5 text-xs font-bold text-[var(--primary)] tabular-nums">
                      {user.actionCount.toLocaleString("vi-VN")} thao tác
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="gap-0 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">
                Hoạt động gần đây
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                10 thao tác mới nhất trên toàn hệ thống
              </p>
            </div>
            <Button
              variant="ghost"
              render={<Link href="/portal/activity" />}
            >
              Xem tất cả
              <ChevronRight aria-hidden />
            </Button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="grid min-h-32 place-items-center p-6 text-sm text-[var(--text-muted)]">
              Chưa có hoạt động nào.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Hoạt động hệ thống gần đây</caption>
                  <thead className="bg-[var(--surface-secondary)] text-xs text-[var(--text-muted)]">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">Thao tác</th>
                      <th scope="col" className="px-5 py-3 font-medium">Người thực hiện</th>
                      <th scope="col" className="px-5 py-3 font-medium">Workspace</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        <td className="px-5 py-3 font-medium text-[var(--foreground)]">
                          {formatActionLabel(entry.action)}
                        </td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">
                          <div className="flex items-center gap-2">
                            <div className="grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,var(--surface))] text-[0.65rem] font-bold text-[var(--primary)]">
                              {(entry.actor?.username ?? "H").slice(0, 1).toUpperCase()}
                            </div>
                            <span>{entry.actor?.username ?? "Hệ thống"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">
                          {entry.workspace.name}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[var(--text-muted)]">
                          {dateTimeFormatter.format(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-3 p-4 md:hidden">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {formatActionLabel(entry.action)}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span>{entry.actor?.username ?? "Hệ thống"} · {entry.workspace.name}</span>
                      <span className="tabular-nums">{dateTimeFormatter.format(entry.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
