import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/base";

type PortalPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
  itemLabel?: string;
};

function getPageNumbers(current: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);

  return pages;
}

export function PortalPagination({
  page,
  totalPages,
  total,
  pageSize,
  buildHref,
  itemLabel = "bản ghi",
}: PortalPaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div
      className="flex flex-col gap-3 border-t border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      aria-label="Phân trang"
    >
      <p className="text-xs text-[var(--text-muted)] tabular-nums">
        Hiển thị <span className="font-semibold text-[var(--foreground)]">{from}–{to}</span> /{" "}
        <span className="font-semibold text-[var(--foreground)]">{total.toLocaleString("vi-VN")}</span> {itemLabel}
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Điều hướng trang">
          {/* Previous page button */}
          {page > 1 ? (
            <Button
              variant="ghost"
              render={<Link href={buildHref(page - 1)} aria-label="Trang trước" />}
            >
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:inline">Trước</span>
            </Button>
          ) : (
            <Button variant="ghost" disabled aria-label="Trang trước">
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:inline">Trước</span>
            </Button>
          )}

          {/* Page numbers (Desktop) */}
          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers.map((item, idx) =>
              item === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="grid size-8 place-items-center text-xs text-[var(--text-muted)] select-none"
                >
                  …
                </span>
              ) : (
                <Button
                  key={`page-${item}`}
                  variant={item === page ? "info" : "ghost"}
                  render={
                    <Link
                      href={buildHref(item)}
                      aria-current={item === page ? "page" : undefined}
                      aria-label={`Trang ${item}`}
                    />
                  }
                >
                  {item}
                </Button>
              ),
            )}
          </div>

          {/* Current page indicator (Mobile) */}
          <span className="text-xs text-[var(--text-muted)] tabular-nums sm:hidden">
            Trang {page}/{totalPages}
          </span>

          {/* Next page button */}
          {page < totalPages ? (
            <Button
              variant="ghost"
              render={<Link href={buildHref(page + 1)} aria-label="Trang sau" />}
            >
              <span className="sr-only sm:not-sr-only sm:inline">Sau</span>
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button variant="ghost" disabled aria-label="Trang sau">
              <span className="sr-only sm:not-sr-only sm:inline">Sau</span>
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
