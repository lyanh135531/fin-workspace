import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import {
  Button,
  Card,
  PageHeader,
  Search,
} from "@/components/base";
import { Badge } from "@/components/ui/badge";
import {
  parsePortalUserSearchParams,
  type PortalUserSearch,
} from "@/domain/platform-user/schemas";
import { env } from "@/lib/env";
import { requirePlatformAdminSession } from "@/services/platform-access";
import {
  listPortalUsers,
  type PortalUserRecord,
} from "@/services/platform-user-query";

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
  if (next.status !== "all") params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `/portal/users?${query}` : "/portal/users";
}

function UserStatusBadge({ status }: Pick<PortalUserRecord, "status">) {
  return (
    <Badge variant={status === "active" ? "outline" : "destructive"}>
      {status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}
    </Badge>
  );
}

export default async function PortalUsersPage({ searchParams }: UsersPageProps) {
  await requirePlatformAdminSession();
  const filters = parsePortalUserSearchParams(await searchParams);
  const result = await listPortalUsers(filters);

  if (filters.page > result.totalPages) {
    redirect(buildUsersHref(filters, { page: result.totalPages }));
  }

  const hasFilters = Boolean(filters.q) || filters.status !== "all";

  return (
    <div>
      <PageHeader
        title="Người dùng"
        description="Tra cứu tài khoản hệ thống. Portal không tải workspace, ví, giao dịch hoặc số dư."
      />

      <Card className="gap-0 p-0">
        <div className="space-y-4 border-b border-[var(--border)] p-4 sm:p-5">
          <form
            action="/portal/users"
            method="get"
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Search
              name="q"
              defaultValue={filters.q}
              placeholder="Tìm theo username"
              aria-label="Tìm người dùng theo username"
              containerClassName="w-full sm:w-80"
            />
            {filters.status !== "all" && (
              <input type="hidden" name="status" value={filters.status} />
            )}
            <div className="flex items-center gap-2">
              <Button variant="landing" type="submit">
                Tìm kiếm
              </Button>
              {hasFilters && (
                <Button variant="ghost" render={<Link href="/portal/users" />}>
                  Xóa lọc
                </Button>
              )}
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2" aria-label="Lọc trạng thái">
            {(
              [
                ["all", "Tất cả"],
                ["active", "Đang hoạt động"],
                ["deactive", "Đã vô hiệu hóa"],
              ] as const
            ).map(([status, label]) => (
              <Button
                key={status}
                variant={filters.status === status ? "info" : "ghost"}
                render={
                  <Link
                    href={buildUsersHref(filters, { status, page: 1 })}
                    aria-current={filters.status === status ? "page" : undefined}
                  />
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 text-sm sm:px-5">
          <p className="text-[var(--text-secondary)]">
            <span className="font-semibold tabular-nums text-[var(--foreground)]">
              {result.total}
            </span>{" "}
            tài khoản
          </p>
          <p className="text-xs tabular-nums text-[var(--text-muted)]">
            Trang {result.page}/{result.totalPages}
          </p>
        </div>

        {result.users.length === 0 ? (
          <div className="grid min-h-56 place-items-center p-6 text-center">
            <div className="max-w-sm">
              <SearchX className="mx-auto size-6 text-[var(--text-muted)]" aria-hidden />
              <h2 className="mt-3 font-semibold">Không tìm thấy người dùng</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                Thử username khác hoặc xóa bộ lọc trạng thái hiện tại.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Danh sách tài khoản người dùng Felix</caption>
                <thead className="bg-[var(--surface-secondary)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Username</th>
                    <th scope="col" className="px-5 py-3 font-medium">Trạng thái</th>
                    <th scope="col" className="px-5 py-3 font-medium">Ngày tạo</th>
                    <th scope="col" className="px-5 py-3 font-medium">Cập nhật cuối</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {result.users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-5 py-4 font-medium text-[var(--foreground)]">
                        {user.username}
                      </td>
                      <td className="px-5 py-4"><UserStatusBadge status={user.status} /></td>
                      <td className="px-5 py-4 tabular-nums text-[var(--text-secondary)]">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-5 py-4 tabular-nums text-[var(--text-secondary)]">
                        {formatDateTime(user.updatedAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
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

            <div className="grid gap-3 p-4 md:hidden">
              {result.users.map((user) => (
                <Card key={user.id} size="sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserRound className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                        <p className="truncate font-semibold" title={user.username}>{user.username}</p>
                      </div>
                      <p className="mt-2 text-xs tabular-nums text-[var(--text-muted)]">
                        Tạo {formatDateTime(user.createdAt)}
                      </p>
                    </div>
                    <UserStatusBadge status={user.status} />
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

        <nav
          className="flex items-center justify-between gap-3 border-t border-[var(--border)] p-4 sm:px-5"
          aria-label="Phân trang người dùng"
        >
          {result.page > 1 ? (
            <Button
              variant="ghost"
              render={<Link href={buildUsersHref(filters, { page: result.page - 1 })} />}
            >
              <ChevronLeft aria-hidden />
              Trang trước
            </Button>
          ) : (
            <span />
          )}
          {result.page < result.totalPages ? (
            <Button
              variant="ghost"
              render={<Link href={buildUsersHref(filters, { page: result.page + 1 })} />}
            >
              Trang sau
              <ChevronRight aria-hidden />
            </Button>
          ) : (
            <span />
          )}
        </nav>
      </Card>
    </div>
  );
}
