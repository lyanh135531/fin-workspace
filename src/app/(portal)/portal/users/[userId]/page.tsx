import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Button, Card, PageContainer, PageHeader } from "@/components/base";
import { Badge } from "@/components/ui/badge";
import { idSchema } from "@/domain/common/schemas";
import { env } from "@/lib/env";
import { requirePlatformAdminSession } from "@/services/platform-access";
import {
  getPortalUserById,
  getPortalUserWorkspaces,
  getPortalUserActivityLogs,
  getPortalUserLastActivity,
} from "@/services/platform-user-query";
import { formatActionLabel } from "../../portal-action-labels";
import { PortalPagination } from "../../portal-pagination";

type UserDetailPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: env.APP_TIME_ZONE,
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: env.APP_TIME_ZONE,
});

export default async function PortalUserDetailPage({
  params,
  searchParams,
}: UserDetailPageProps) {
  await requirePlatformAdminSession();
  const { userId } = await params;
  const sp = await searchParams;

  if (!idSchema.safeParse(userId).success) notFound();

  const activityPage = Math.max(1, Number(sp.activityPage) || 1);

  const [user, workspaces, activityResult, lastActivity] = await Promise.all([
    getPortalUserById(userId),
    getPortalUserWorkspaces(userId),
    getPortalUserActivityLogs(userId, activityPage),
    getPortalUserLastActivity(userId),
  ]);

  if (!user) notFound();

  const fields = [
    ["Username", user.username],
    ["Ngày tạo", dateTimeFormatter.format(user.createdAt)],
    ["Thao tác lần cuối", lastActivity ? dateTimeFormatter.format(lastActivity) : "Chưa có"],
  ] as const;

  return (
    <PageContainer className="flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={user.username}
        description="Thông tin tài khoản, workspace và lịch sử hoạt động."
      >
        <Button variant="ghost" render={<Link href="/portal/users" />}>
          <ArrowLeft aria-hidden />
          Danh sách user
        </Button>
      </PageHeader>

      {/* Basic Info */}
      <Card>
        <div className="border-b border-[var(--border)] pb-4">
          <h2 className="font-semibold">Hồ sơ tài khoản</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Chế độ chỉ đọc</p>
        </div>

        <dl className="divide-y divide-[var(--border)]">
          {fields.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm font-medium text-[var(--text-muted)]">{label}</dt>
              <dd className="[overflow-wrap:anywhere] text-sm text-[var(--foreground)] sm:text-right">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Workspaces */}
      <Card className="gap-0 p-0">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="font-semibold text-[var(--foreground)]">
            Workspace ({workspaces.length})
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Các workspace mà user tham gia
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="grid min-h-32 place-items-center p-6 text-sm text-[var(--text-muted)]">
            User chưa tham gia workspace nào.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Workspace của {user.username}</caption>
                <thead className="bg-[var(--surface-secondary)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Workspace</th>
                    <th scope="col" className="px-5 py-3 font-medium">Vai trò</th>
                    <th scope="col" className="px-5 py-3 font-medium">Trạng thái</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Ngày tham gia</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((ws) => (
                    <tr
                      key={ws.id}
                      className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--foreground)]">
                        {ws.workspace.name}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        <Badge variant="outline">
                          {ws.role.name}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={ws.status === "active" ? "outline" : "destructive"}>
                          {ws.status === "active" ? "Hoạt động" : "Vô hiệu"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[var(--text-muted)]">
                        {shortDateTimeFormatter.format(ws.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 p-4 md:hidden">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {ws.workspace.name}
                    </p>
                    <Badge variant={ws.status === "active" ? "outline" : "destructive"}>
                      {ws.status === "active" ? "Hoạt động" : "Vô hiệu"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <Badge variant="outline">{ws.role.name}</Badge>
                    <span className="tabular-nums">
                      {shortDateTimeFormatter.format(ws.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Activity Log */}
      <Card className="gap-0 p-0">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">
              Lịch sử hoạt động
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {activityResult.total} thao tác · Trang {activityResult.page}/{activityResult.totalPages}
            </p>
          </div>
        </div>

        {activityResult.logs.length === 0 ? (
          <div className="grid min-h-32 place-items-center p-6 text-sm text-[var(--text-muted)]">
            Chưa có hoạt động nào được ghi nhận.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Lịch sử hoạt động của {user.username}
                </caption>
                <thead className="bg-[var(--surface-secondary)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Thao tác</th>
                    <th scope="col" className="px-5 py-3 font-medium">Workspace</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {activityResult.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--foreground)]">
                        {formatActionLabel(log.action)}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        {log.workspace.name}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[var(--text-muted)]">
                        {shortDateTimeFormatter.format(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 p-4 md:hidden">
              {activityResult.logs.map((log) => (
                <div
                  key={log.id}
                  className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {formatActionLabel(log.action)}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>{log.workspace.name}</span>
                    <span className="tabular-nums">
                      {shortDateTimeFormatter.format(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <PortalPagination
          page={activityResult.page}
          totalPages={activityResult.totalPages}
          total={activityResult.total}
          pageSize={activityResult.pageSize}
          buildHref={(p) => `/portal/users/${userId}?activityPage=${p}`}
          itemLabel="hoạt động"
        />
      </Card>
    </PageContainer>
  );
}
