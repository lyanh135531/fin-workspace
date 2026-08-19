"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button, Search } from "@/components/base";

type PortalUserFiltersProps = {
  q: string;
};

export function PortalUserFilters({ q }: PortalUserFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(q);
  }, [q]);

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

  const hasFilters = Boolean(q);

  return (
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
  );
}
