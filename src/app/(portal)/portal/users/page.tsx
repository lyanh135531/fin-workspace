import Link from "next/link";
import { ChevronRight, SearchX, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import {
  Button,
  Card,
  PageContainer,
  PageHeader,
} from "@/components/base";
import {
  parsePortalUserSearchParams,
  type PortalUserSearch,
} from "@/domain/platform-user/schemas";
import { env } from "@/lib/env";
import { requirePlatformAdminSession } from "@/services/platform-access";
import { listPortalUsers, PORTAL_USER_PAGE_SIZE } from "@/services/platform-user-query";
import { PortalPagination } from "../portal-pagination";
import { PortalUserFilters } from "./portal-user-filters";

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: env.APP_TIME_ZONE,
});

function formatDateTime(value: Date | null) {
  return value ? dateTimeFormatter.format(value) : "Chưa có";
}

function buildUsersHref(
  filters: PortalUserSearch,
  overrides: Partial<PortalUserSearch>,
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `/portal/users?${query}` : "/portal/users";
}

export default async function PortalUsersPage({ searchParams }: UsersPageProps) {
  await requirePlatformAdminSession();
  const filters = parsePortalUserSearchParams(await searchParams);
  const result = await listPortalUsers(filters);

  if (filters.page > result.totalPages) {
    redirect(buildUsersHref(filters, { page: result.totalPages }));
  }

  return (
    <PageContainer className="flex flex-1 min-h-0 flex-col h-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Người dùng"
        description="Tra cứu tài khoản hệ thống."
        className="shrink-0"
      />

      <Card className="flex flex-1 min-h-0 flex-col gap-0 p-0 overflow-hidden">
        {/* Search header (Fixed top) */}
        <div className="shrink-0 space-y-4 border-b border-[var(--border)] p-4 sm:p-5">
          <PortalUserFilters q={filters.q} />
        </div>

        {/* Scrollable Table Container */}
        <div className="flex-1 min-h-0 overflow-auto">
          {result.users.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-6 text-center">
              <div className="max-w-sm">
                <SearchX className="mx-auto size-6 text-[var(--text-muted)]" aria-hidden />
                <h2 className="mt-3 font-semibold">Không tìm thấy người dùng</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Thử tìm kiếm với username khác.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table with Sticky Header */}
              <div className="hidden min-w-full md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Danh sách tài khoản người dùng Felix</caption>
                  <thead className="sticky top-0 z-10 bg-[var(--surface-secondary)] text-xs text-[var(--text-muted)] shadow-[0_1px_0_0_var(--border)]">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">Username</th>
                      <th scope="col" className="px-5 py-3 font-medium">Ngày tạo</th>
                      <th scope="col" className="px-5 py-3 font-medium">Thao tác lần cuối</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,var(--surface))] text-xs font-bold text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_25%,transparent)]">
                              {user.username.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="font-medium text-[var(--foreground)]">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-[var(--text-secondary)]">
                          {formatDateTime(user.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-[var(--text-secondary)]">
                          {formatDateTime(user.lastActivityAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            render={<Link href={`/portal/users/${user.id}`} />}
                          >
                            Xem
                            <ChevronRight aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="grid gap-3 p-4 md:hidden">
                {result.users.map((user) => (
                  <Card key={user.id} size="sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,var(--surface))] text-[0.65rem] font-bold text-[var(--primary)]">
                            {user.username.slice(0, 1).toUpperCase()}
                          </div>
                          <p className="truncate font-semibold text-[var(--foreground)]" title={user.username}>{user.username}</p>
                        </div>
                        <p className="mt-2 text-xs tabular-nums text-[var(--text-muted)]">
                          Tạo {formatDateTime(user.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      render={<Link href={`/portal/users/${user.id}`} />}
                    >
                      Xem chi tiết
                      <ChevronRight aria-hidden />
                    </Button>
                  </Card>
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
            pageSize={PORTAL_USER_PAGE_SIZE}
            buildHref={(p) => buildUsersHref(filters, { page: p })}
            itemLabel="tài khoản"
          />
        </div>
      </Card>
    </PageContainer>
  );
}
