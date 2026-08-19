"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button, Search } from "@/components/base";

type PortalUserFiltersProps = {
  q: string;
  status: "all" | "active" | "deactive";
};

const statusOptions = [
  ["all", "Tất cả"],
  ["active", "Đang hoạt động"],
  ["deactive", "Đã vô hiệu hóa"],
] as const;

export function PortalUserFilters({ q, status }: PortalUserFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(q);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim() === q.trim()) return;

      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");

      const query = params.toString();
      startTransition(() => {
        router.push(query ? `/portal/users?${query}` : "/portal/users");
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, q, router, searchParams]);

  const hasFilters = Boolean(q) || status !== "all";

  function buildStatusHref(nextStatus: typeof status) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextStatus !== "all") params.set("status", nextStatus);
    const query = params.toString();
    return query ? `/portal/users?${query}` : "/portal/users";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Search
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tìm theo username..."
          aria-label="Tìm người dùng theo username"
          containerClassName="w-full sm:w-80"
        />
        {hasFilters && (
          <Button variant="ghost" render={<Link href="/portal/users" />}>
            Xóa lọc
          </Button>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Lọc trạng thái tài khoản"
      >
        {statusOptions.map(([value, label]) => (
          <Button
            key={value}
            variant={status === value ? "info" : "ghost"}
            render={
              <Link
                href={buildStatusHref(value)}
                aria-current={status === value ? "page" : undefined}
              />
            }
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
