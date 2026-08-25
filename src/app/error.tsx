"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button, Card } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[felix-client-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 py-12 text-[var(--foreground)] sm:px-6">
      <Card as="section" className="w-full max-w-xl" aria-labelledby="error-title">
        <div className="flex items-start gap-4">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger)]"
            aria-hidden="true"
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <FinLogo size={28} showText />
            <h1 id="error-title" className="mt-5 text-xl font-semibold">
              Felix chưa thể tải nội dung này
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Dữ liệu của bạn không bị thay đổi. Hãy thử tải lại; nếu lỗi tiếp
              tục xảy ra, gửi mã tham chiếu cho người hỗ trợ.
            </p>
            {error.digest && (
              <p className="mt-3 break-all text-xs text-[var(--text-muted)]">
                Mã tham chiếu: <code>{error.digest}</code>
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Thử tải lại
          </Button>
          <Button
            variant="ghost"
            size="lg"
            nativeButton={false}
            render={<Link href="/overview" />}
          >
            Về trang tổng quan
          </Button>
        </div>
      </Card>
    </main>
  );
}
