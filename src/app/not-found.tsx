import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  CircleDollarSign,
  FileQuestion,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { authOptions } from "@/auth";
import { Button } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

export const metadata: Metadata = {
  title: "Không tìm thấy trang",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const session = await getServerSession(authOptions);
  const accountHref = session?.user?.id ? "/overview" : "/sign-in";

  return (
    <main
      id="main-content"
      className="relative min-h-[100dvh] overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
    >
      <div
        className="pointer-events-none absolute -left-24 top-1/3 size-72 rounded-full bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <header className="relative mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between px-4 sm:min-h-20 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Felix, trang chủ">
          <FinLogo size={34} showText />
        </Link>
        <ThemeToggle />
      </header>

      <section className="relative mx-auto grid w-full max-w-[90rem] items-center gap-12 px-4 py-10 sm:px-6 sm:py-16 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 lg:px-10 lg:py-12">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 border-b border-[var(--primary)] pb-2 text-xs font-semibold tracking-[0.14em] text-[var(--primary)]">
            <FileQuestion className="size-4" aria-hidden="true" />
            KHÔNG TÌM THẤY TRANG
          </div>

          <h1 className="mt-7 text-balance font-serif text-[clamp(3.25rem,7vw,6.75rem)] font-bold leading-[0.98] tracking-[-0.065em] sm:mt-9">
            Trang bạn tìm hiện không tồn tại.
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:leading-8">
            Đừng lo, dữ liệu tài chính của bạn vẫn an toàn. Hãy quay về trang
            chủ để tiếp tục công việc.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10">
            <Button
              size="lg"
              variant="landing"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <ArrowLeft aria-hidden="true" />
              Về trang chủ
            </Button>
            <Button
              size="lg"
              variant="ghost"
              nativeButton={false}
              render={<Link href={accountHref} />}
            >
              {session?.user?.id ? "Vào Felix" : "Đăng nhập"}
            </Button>
          </div>
        </div>

        <div
          className="relative mx-auto aspect-square w-full max-w-[35rem] select-none lg:mr-0"
          aria-hidden="true"
        >
          <div className="absolute inset-[5%] rounded-full border border-[color-mix(in_srgb,var(--border)_72%,transparent)]" />
          <div className="absolute inset-[15%] rounded-full border border-dashed border-[color-mix(in_srgb,var(--primary)_32%,var(--border))]" />
          <div className="absolute inset-[28%] rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]" />

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-[clamp(7.5rem,22vw,15rem)] font-bold leading-none tracking-[-0.11em] text-[var(--primary)]">
              404
            </span>
          </div>

          <div className="absolute left-[6%] top-[42%] flex size-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] sm:size-14">
            <WalletCards className="size-5 sm:size-6" />
          </div>
          <div className="absolute right-[11%] top-[15%] flex size-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] sm:size-14">
            <ReceiptText className="size-5 sm:size-6" />
          </div>
          <div className="absolute bottom-[8%] right-[28%] flex size-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] sm:size-14">
            <CircleDollarSign className="size-5 sm:size-6" />
          </div>

          <p className="absolute bottom-[18%] left-[8%] max-w-32 text-xs font-medium leading-5 text-[var(--text-muted)] sm:max-w-40 sm:text-sm">
            Không có giao dịch nào tại tọa độ này.
          </p>
        </div>
      </section>
    </main>
  );
}
