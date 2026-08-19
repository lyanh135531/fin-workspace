import { SearchX } from "lucide-react";
import { redirect } from "next/navigation";

import {
  Card,
  PageContainer,
  PageHeader,
} from "@/components/base";
import { env } from "@/lib/env";
import { requirePlatformAdminSession } from "@/services/platform-access";
import {
  listPortalAuditLogs,
  PORTAL_ACTIVITY_PAGE_SIZE,
} from "@/services/portal-activity-query";
import {
  parsePortalActivitySearchParams,
  type PortalActivitySearch,
} from "@/domain/platform-user/portal-activity-schemas";
import { formatActionLabel } from "../portal-action-labels";
import { PortalPagination } from "../portal-pagination";
import { PortalActivityFilters } from "./portal-activity-filters";

type ActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: env.APP_TIME_ZONE,
});

function buildActivityHref(
  filters: PortalActivitySearch,
  overrides: Partial<PortalActivitySearch>,
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.dateFrom) params.set("dateFrom", next.dateFrom);
  if (next.dateTo) params.set("dateTo", next.dateTo);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `/portal/activity?${query}` : "/portal/activity";
}

export default async function PortalActivityPage({
  searchParams,
}: ActivityPageProps) {
  await requirePlatformAdminSession();
  const filters = parsePortalActivitySearchParams(await searchParams);
  const result = await listPortalAuditLogs(filters);

  if (filters.page > result.totalPages) {
    redirect(buildActivityHref(filters, { page: result.totalPages }));
  }

  return (
    <PageContainer className="flex flex-1 min-h-0 flex-col h-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Nhật ký hoạt động"
        description="Toàn bộ audit log trên hệ thống Felix."
        className="shrink-0"
      />

      <Card className="flex flex-1 min-h-0 flex-col gap-0 p-0 overflow-hidden">
        {/* Filters Header (Fixed top) */}
        <div className="shrink-0 space-y-4 border-b border-[var(--border)] p-4 sm:p-5">
          <PortalActivityFilters
            key={`${filters.q}:${filters.dateFrom ?? ""}:${filters.dateTo ?? ""}`}
            q={filters.q}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />
        </div>

        {/* Scrollable Table Container */}
        <div className="flex-1 min-h-0 overflow-auto">
          {result.logs.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-6 text-center">
              <div className="max-w-sm">
                <SearchX className="mx-auto size-6 text-[var(--text-muted)]" aria-hidden />
                <h2 className="mt-3 font-semibold">Không tìm thấy bản ghi</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Thử thay đổi bộ lọc hoặc khoảng thời gian.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table with Sticky Header */}
              <div className="hidden min-w-full md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Nhật ký hoạt động hệ thống</caption>
                  <thead className="sticky top-0 z-10 bg-[var(--surface-secondary)] text-xs text-[var(--text-muted)] shadow-[0_1px_0_0_var(--border)]">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">Thao tác</th>
                      <th scope="col" className="px-5 py-3 font-medium">Người thực hiện</th>
                      <th scope="col" className="px-5 py-3 font-medium">Workspace</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.logs.map((entry) => (
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

              {/* Mobile Cards */}
              <div className="grid gap-3 p-4 md:hidden">
                {result.logs.map((entry) => (
                  <div
                    key={entry.id}
                    className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {formatActionLabel(entry.action)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5">
                        <span className="grid size-5 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,var(--surface))] text-[0.6rem] font-bold text-[var(--primary)]">
                          {(entry.actor?.username ?? "H").slice(0, 1).toUpperCase()}
                        </span>
                        {entry.actor?.username ?? "Hệ thống"}
                      </span>
                      <span>·</span>
                      <span>{entry.workspace.name}</span>
                    </div>
                    <p className="text-xs tabular-nums text-[var(--text-muted)]">
                      {dateTimeFormatter.format(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Pagination (Fixed bottom) */}
        <div className="shrink-0">
          <PortalPagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={PORTAL_ACTIVITY_PAGE_SIZE}
            buildHref={(p) => buildActivityHref(filters, { page: p })}
            itemLabel="bản ghi"
          />
        </div>
      </Card>
    </PageContainer>
  );
}
