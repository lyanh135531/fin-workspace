import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Fingerprint,
  LockKeyhole,
  ReceiptText,
  Repeat2,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

const siteUrl = "https://felixwise.io.vn";

export const metadata: Metadata = {
  title: { absolute: "Felix | Quản lý tài chính tập trung" },
  description:
    "Felix giúp gia đình và nhóm cùng theo dõi ví, thu chi, giao dịch định kỳ và lịch sử số dư trong một không gian chung.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Felix",
    title: "Felix | Quản lý tài chính tập trung",
    description: "Cùng theo dõi tiền đang ở đâu, đã chi vào việc gì.",
    images: [
      {
        url: "/felix-open-graph.png",
        width: 1200,
        height: 630,
        alt: "Felix — không gian tài chính chung cho gia đình và nhóm",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Felix | Quản lý tài chính tập trung",
    description: "Cùng theo dõi tiền đang ở đâu, đã chi vào việc gì.",
    images: ["/felix-open-graph.png"],
  },
};

const transactions = [
  {
    name: "Lương tháng 8",
    meta: "Thu nhập · hôm nay",
    amount: "+32.500.000 ₫",
    type: "income",
  },
  {
    name: "Tiền nhà",
    meta: "Nhà cửa · hôm qua",
    amount: "−8.200.000 ₫",
    type: "expense",
  },
  {
    name: "Đi chợ cuối tuần",
    meta: "Ăn uống · 16 tháng 8",
    amount: "−684.000 ₫",
    type: "expense",
  },
] as const;

const principles = [
  {
    number: "01",
    title: "Đồng bộ dữ liệu real-time",
    description:
      "Gom toàn bộ giao dịch từ tin nhắn, bảng tính về một nơi. Rõ ràng người ghi nhận, thời gian và trạng thái xử lý.",
  },
  {
    number: "02",
    title: "Lịch sử giao dịch chi tiết",
    description:
      "Gắn chính xác mọi biến động vào đúng ví. Dễ dàng đối chiếu lịch sử chỉ trong vài giây.",
  },
  {
    number: "03",
    title: "Quản lý chi tiêu định kỳ.",
    description:
      "Lên lịch trước cho tiền nhà, hóa đơn hay quỹ chung. Nhận thông báo sớm để luôn sẵn sàng dòng tiền.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Felix",
      inLanguage: "vi-VN",
      description: "Không gian tài chính chung cho cá nhân, gia đình và nhóm.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#application`,
      name: "Felix",
      applicationCategory: "FinanceApplication",
      applicationSubCategory: "Personal Finance Management",
      operatingSystem: "Web",
      url: siteUrl,
      inLanguage: "vi-VN",
      description:
        "Ứng dụng web giúp cá nhân, gia đình và nhóm theo dõi thu chi, ví, số dư và giao dịch định kỳ.",
    },
  ],
};

function ProductCanvas() {
  return (
    <figure
      className="relative mx-auto w-full max-w-[23rem] sm:max-w-[42rem] lg:mx-0"
      aria-label="Bản xem trước không gian tài chính Felix"
    >
      <div
        className="absolute -inset-12 -z-10 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] blur-3xl"
        aria-hidden
      />
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] sm:rounded-[2rem]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5 sm:px-7 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <WalletCards className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Nhà của bạn
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                4 thành viên · 3 ví
              </p>
            </div>
          </div>
          <span className="hidden items-center gap-2 text-xs font-medium text-[var(--success)] sm:flex">
            <span className="size-1.5 rounded-full bg-[var(--success)]" />
            Đã đồng bộ
          </span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-[var(--border)] p-4 sm:p-7 lg:border-r lg:border-b-0">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Tổng tài sản khả dụng
            </p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-[var(--foreground)] tabular-nums sm:text-4xl">
              48.620.500{" "}
              <span className="text-base font-medium tracking-normal text-[var(--text-muted)]">
                ₫
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--success)]">+6,8%</span>
              <span className="text-[var(--text-muted)]">
                so với tháng trước
              </span>
            </div>

            <div
              className="mt-6 flex h-24 items-end gap-2 sm:mt-8 sm:h-32"
              aria-label="Biểu đồ dòng tiền sáu tháng gần nhất"
            >
              {[38, 52, 44, 68, 58, 84, 72, 96, 78, 100, 88, 118].map(
                (height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className={`flex-1 rounded-t-md ${index === 11 ? "bg-[var(--primary)]" : "bg-[var(--primary-soft)]"}`}
                    style={{ height: `${height / 1.18}%` }}
                  />
                ),
              )}
            </div>
            <div className="mt-3 flex justify-between text-[0.65rem] font-medium text-[var(--text-muted)]">
              <span>Tháng 3</span>
              <span>Tháng 8</span>
            </div>
          </div>

          <div className="hidden p-5 sm:block sm:p-7">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Ví của bạn
              </p>
              <span className="text-xs text-[var(--primary)]">Xem tất cả</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Ví gia đình", "28.420.500 ₫", "primary"],
                ["Tiết kiệm", "16.000.000 ₫", "secondary"],
                ["Tiền mặt", "4.200.000 ₫", "muted"],
              ].map(([name, amount, tone]) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                >
                  <span className="flex items-center gap-3 text-xs font-medium text-[var(--text-secondary)]">
                    <span
                      className={`size-2 rounded-full ${
                        tone === "primary"
                          ? "bg-[var(--primary)]"
                          : tone === "secondary"
                            ? "bg-[var(--secondary)]"
                            : "bg-[var(--text-muted)]"
                      }`}
                    />
                    {name}
                  </span>
                  <strong className="text-xs font-semibold text-[var(--foreground)] tabular-nums">
                    {amount}
                  </strong>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-[var(--surface-secondary)] p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--primary)]">
                  <Repeat2 className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground)]">
                    Tiền điện sắp tới hạn
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-[var(--text-muted)]">
                    Ngày 20 tháng 8 · 1.240.000 ₫
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-4 py-4 sm:px-7">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              Giao dịch gần đây
            </p>
            <ReceiptText
              className="size-4 text-[var(--text-muted)]"
              aria-hidden
            />
          </div>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {transactions.map((transaction, index) => (
              <div
                key={transaction.name}
                className={`${index === 2 ? "hidden sm:flex" : "flex"} items-center justify-between gap-4 py-3 first:pt-1 last:pb-0`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--foreground)]">
                    {transaction.name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-[var(--text-muted)]">
                    {transaction.meta}
                  </p>
                </div>
                <strong
                  className={`shrink-0 text-xs font-semibold tabular-nums ${transaction.type === "income" ? "text-[var(--income)]" : "text-[var(--expense)]"}`}
                >
                  {transaction.amount}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -right-3 -bottom-7 hidden max-w-52 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex lg:-right-8">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]">
          <Check className="size-4" aria-hidden />
        </span>
        <p className="text-xs font-medium leading-5 text-[var(--foreground)]">
          Tháng này bạn còn 32% ngân sách
        </p>
      </div>
    </figure>
  );
}

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="min-h-[100dvh] overflow-hidden bg-[var(--background)] pt-16 sm:pt-20"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[var(--background)]">
        <nav
          className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-3 px-4 sm:min-h-20 sm:gap-4 sm:px-6 lg:px-10"
          aria-label="Điều hướng chính"
        >
          <Link href="/" aria-label="Felix, trang chủ">
            <FinLogo size={34} showText />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#cach-hoat-dong"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Về Felix
            </Link>
            <Link
              href="#tinh-nang"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Tính năng
            </Link>
            <Link
              href="#bao-mat"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Bảo mật
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="hidden sm:inline-flex">
              <ThemeToggle />
            </span>
            <span className="inline-flex">
              <Button
                variant="landing"
                nativeButton={false}
                render={<Link href="/setup" />}
              >
                <span className="sm:hidden">Bắt đầu</span>
                <span className="hidden sm:inline">Dùng thử miễn phí</span>
              </Button>
            </span>
          </div>
        </nav>
      </header>

      <section className="relative">
        <div
          className="pointer-events-none absolute -top-24 right-[8%] size-[28rem] rounded-full bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] blur-3xl"
          aria-hidden
        />
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[90rem] items-center gap-10 px-4 py-10 sm:min-h-[calc(100dvh-5rem)] sm:gap-16 sm:px-6 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:px-10 lg:py-24 xl:gap-24">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 border-b border-[var(--primary)] pb-2 text-[0.65rem] font-semibold tracking-[0.11em] text-[var(--primary)] sm:text-xs sm:tracking-[0.14em]">
              <CircleDollarSign className="size-4" aria-hidden />
              GIẢI PHÁP TÀI CHÍNH CHO GIA ĐÌNH VÀ NHÓM
            </div>
            <h1 className="mt-6 text-balance font-serif text-[3.15rem] font-bold leading-[1.1] tracking-[-0.055em] text-[var(--foreground)] sm:mt-8 sm:text-[clamp(3.5rem,7.4vw,7.5rem)] sm:leading-[0.94] sm:tracking-[-0.075em]">
              Rõ ràng thu chi
              <br />
              <span className="text-[var(--primary)]">An tâm quản lý</span>
            </h1>
            <p className="mt-6 max-w-[38rem] text-pretty text-base leading-7 text-[var(--text-secondary)] sm:mt-8 sm:text-xl sm:leading-8">
              Theo dõi dòng tiền, hóa đơn định kỳ và ngân sách chung trên một
              nền tảng duy nhất.
            </p>
            <div className="mt-8 grid gap-3 sm:mt-10 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
              <Button
                className="w-full sm:w-auto"
                size="lg"
                variant="landing"
                nativeButton={false}
                render={<Link href="/setup" />}
              >
                Trải nghiệm miễn phí
                <ArrowRight aria-hidden />
              </Button>
              <Link
                href="#cach-hoat-dong"
                className="group inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-[var(--foreground)] sm:min-h-0 sm:justify-start"
              >
                Tìm hiểu thêm
                <ArrowUpRight
                  className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-5 text-[0.7rem] font-medium text-[var(--text-muted)] sm:mt-14 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3 sm:pt-6 sm:text-xs">
              <span className="flex items-center gap-2">
                <Check className="size-3.5 text-[var(--success)]" aria-hidden />
                Không cần thẻ thanh toán
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-3.5 text-[var(--success)]" aria-hidden />
                Bắt đầu trong vài phút
              </span>
              <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <Check className="size-3.5 text-[var(--success)]" aria-hidden />
                Đồng bộ trên mọi thiết bị
              </span>
            </div>
          </div>

          <ProductCanvas />
        </div>
      </section>

      <section
        className="border-y border-[var(--border)] bg-[var(--surface)]"
        aria-label="Giá trị của Felix"
      >
        <div className="mx-auto grid max-w-[90rem] divide-y divide-[var(--border)] px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
          {[
            [
              "01",
              "Tập trung dữ liệu",
              "Chấm dứt cảnh tìm kiếm rời rạc trên Excel hay tin nhắn chat",
            ],
            [
              "02",
              "Phân quyền linh hoạt",
              "Đội ngũ dễ dàng đóng góp, quản lý luôn nắm trọn quyền kiểm soát",
            ],
            [
              "03",
              "Dữ liệu minh bạch",
              "Dễ dàng truy xuất mọi giao dịch và lịch sử chỉnh sửa bất cứ khi nà",
            ],
          ].map(([number, title, copy]) => (
            <div
              key={number}
              className="grid grid-cols-[auto_1fr] gap-4 py-6 sm:gap-5 sm:py-8 md:px-8 md:first:pl-0 md:last:pr-0"
            >
              <span className="font-mono text-xs text-[var(--primary)]">
                {number}
              </span>
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  {title}
                </p>
                <p className="mt-2 max-w-[28ch] text-sm leading-6 text-[var(--text-muted)]">
                  {copy}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="cach-hoat-dong"
        className="bg-[var(--surface)] py-20 sm:py-32 lg:py-40"
        aria-labelledby="principles-heading"
      >
        <div className="mx-auto grid max-w-[90rem] gap-10 px-4 sm:gap-16 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--primary)]">
              CÁCH FELIX GIÚP BẠN QUẢN LÝ
            </p>
            <h2
              id="principles-heading"
              className="mt-5 max-w-xl text-balance font-serif text-3xl font-bold leading-[1.1] tracking-[-0.045em] text-[var(--foreground)] sm:mt-6 sm:text-5xl sm:leading-[1] sm:tracking-[-0.055em] lg:text-6xl"
            >
              Quản lý dòng tiền thông minh & chuẩn xác.
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {principles.map((principle) => (
              <article
                key={principle.number}
                className="group grid grid-cols-[2.25rem_1fr] gap-3 py-8 sm:grid-cols-[4rem_1fr] sm:gap-5 sm:py-12"
              >
                <span className="font-mono text-sm text-[var(--primary)]">
                  {principle.number}
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.035em] text-[var(--foreground)] transition-transform duration-300 group-hover:translate-x-1 sm:text-3xl">
                    {principle.title}
                  </h3>
                  <p className="mt-3 max-w-[58ch] text-sm leading-6 text-[var(--text-secondary)] sm:mt-4 sm:text-lg sm:leading-8">
                    {principle.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="tinh-nang"
        className="bg-[var(--background)] py-20 sm:py-32 lg:py-40"
        aria-labelledby="features-heading"
      >
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--primary)]">
                ĐỦ THÔNG TIN, KHÔNG RỐI MẮT
              </p>
              <h2
                id="features-heading"
                className="mt-5 max-w-2xl text-balance font-serif text-3xl font-bold leading-[1.08] tracking-[-0.045em] text-[var(--foreground)] sm:mt-6 sm:text-5xl sm:leading-[1.02] sm:tracking-[-0.055em] lg:text-6xl"
              >
                Toàn cảnh cho quản lý. Dễ dàng cho thành viên.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-[var(--text-secondary)] lg:justify-self-end lg:text-lg lg:leading-8">
              Giao diện tối giản. Felix tự động phân loại theo ví, giao dịch và
              phân quyền để ai cũng có thể dùng thành thạo ngay lần đầu.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-12 lg:auto-rows-[15rem]">
            <article className="group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:rounded-[2rem] sm:p-9 lg:col-span-7 lg:row-span-2">
              <WalletCards
                className="size-7 text-[var(--primary)]"
                aria-hidden
              />
              <h3 className="mt-6 max-w-md text-2xl font-semibold tracking-[-0.045em] text-[var(--foreground)] sm:mt-8 sm:text-4xl">
                Quản lý đa ví
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-secondary)] sm:mt-4 sm:text-base sm:leading-7">
                Theo dõi tiền mặt, tài khoản chung và các quỹ tiết kiệm với số
                dư cập nhật real-time cho từng ví.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
                {[
                  ["Gia đình", "28,4 tr"],
                  ["Dự phòng", "16 tr"],
                  ["Tiền mặt", "4,2 tr"],
                ].map(([name, amount], index) => (
                  <div
                    key={name}
                    className="rounded-xl bg-[var(--surface-secondary)] p-3 transition-transform duration-300 group-hover:-translate-y-1 sm:rounded-2xl sm:p-4"
                    style={{ transitionDelay: `${index * 40}ms` }}
                  >
                    <p className="text-xs text-[var(--text-muted)]">{name}</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)] tabular-nums sm:text-lg">
                      {amount}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--primary)] p-6 text-[var(--text-on-primary)] sm:rounded-[2rem] sm:p-9 lg:col-span-5">
              <CalendarDays className="size-7" aria-hidden />
              <div className="mt-6 flex items-end justify-between gap-6 sm:mt-8">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.035em]">
                    Chủ động khoản chi định kỳ
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 opacity-80">
                    Đặt lịch tự động, luôn chủ động chuẩn bị dòng tiền trước
                    ngày thanh toán.
                  </p>
                </div>
                <span className="hidden shrink-0 font-mono text-5xl font-medium tracking-[-0.08em] opacity-25 sm:block">
                  20/08
                </span>
              </div>
            </article>

            <article className="grid overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-2 sm:rounded-[2rem] lg:col-span-5">
              <div className="p-6 sm:p-9">
                <UsersRound
                  className="size-7 text-[var(--primary)]"
                  aria-hidden
                />
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-[var(--foreground)] sm:mt-8">
                  Bảo mật & Rõ ràng trách nhiệm
                </h3>
              </div>
              <div className="flex min-h-0 flex-col justify-center gap-3 bg-[var(--surface-secondary)] p-6 sm:min-h-48 sm:p-7">
                {["Bạn · Admin", "Tuấn · Thành viên", "Tùng · Thành viên"].map(
                  (member, index) => (
                    <div key={member} className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--surface)] text-xs font-bold text-[var(--primary)]">
                        {index + 1}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {member}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        id="bao-mat"
        className="border-y border-[var(--border)] bg-[var(--surface)] py-20 sm:py-32"
        aria-labelledby="security-heading"
      >
        <div className="mx-auto grid max-w-[90rem] gap-10 px-4 sm:gap-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:px-10">
          <div>
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <Fingerprint className="size-7" aria-hidden />
            </span>
            <h2
              id="security-heading"
              className="mt-6 max-w-2xl text-balance font-serif text-3xl font-bold leading-[1.08] tracking-[-0.045em] text-[var(--foreground)] sm:mt-8 sm:text-5xl sm:leading-[1.02] sm:tracking-[-0.055em] lg:text-6xl"
            >
              Không gian tài chính riêng biệt & an toàn.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:mt-6 sm:text-lg sm:leading-8">
              Mỗi nhóm hay gia đình có một không gian độc lập. Quản trị viên dễ
              dàng kiểm soát, thành viên thao tác đúng vai trò mà không lo xáo
              trộn dữ liệu.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--border)] sm:rounded-[2rem]">
            {[
              [
                LockKeyhole,
                "Không gian độc lập",
                "Dữ liệu từng nhóm hoàn toàn riêng biệt, đảm bảo riêng tư tuyệt đối.",
              ],
              [
                UsersRound,
                "Phân quyền linh hoạt",
                "Phân chia rõ ràng người quản lý, người duyệt chi và người nhập liệu.",
              ],
              [
                ReceiptText,
                "Nhật ký minh bạch",
                "Tự động lưu trữ mọi giao dịch và chỉnh sửa để dễ dàng đối chiếu.",
              ],
              [
                Fingerprint,
                "Giới hạn phạm vi",
                "Thành viên chỉ thấy và thao tác trên đúng các phần việc được giao.",
              ],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof LockKeyhole;
              return (
                <article
                  key={title as string}
                  className="bg-[var(--surface)] p-5 sm:p-8"
                >
                  <FeatureIcon
                    className="size-5 text-[var(--primary)]"
                    aria-hidden
                  />
                  <h3 className="mt-5 text-sm font-semibold text-[var(--foreground)] sm:mt-8 sm:text-base">
                    {title as string}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)] sm:text-sm sm:leading-6">
                    {copy as string}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[var(--background)] py-20 sm:py-32 lg:py-40">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl bg-[var(--foreground)] px-5 py-12 text-left text-[var(--background)] sm:rounded-[2.5rem] sm:px-12 sm:py-24 sm:text-center">
            <div
              className="absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--primary)_30%,transparent)] blur-3xl"
              aria-hidden
            />
            <p className="relative text-xs font-semibold tracking-[0.14em] text-[var(--primary)]">
              BẮT ĐẦU HOÀN TOÀN MIỄN PHÍ
            </p>
            <h2 className="relative mx-auto mt-5 max-w-4xl text-balance font-serif text-3xl font-bold leading-[1.08] tracking-[-0.045em] sm:mt-6 sm:text-6xl sm:leading-[1.02] sm:tracking-[-0.06em] lg:text-7xl">
              Sẵn sàng làm chủ tài chính chung ngay hôm nay.
            </h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-sm leading-6 opacity-70 sm:mt-6 sm:text-lg sm:leading-7">
              Thiết lập ví chung, mời thành viên và bắt đầu theo dõi dòng tiền
              chỉ trong chưa đầy 2 phút.
            </p>
            <div className="relative mt-8 flex sm:mt-10 sm:justify-center">
              <Button
                className="w-full sm:w-auto"
                size="lg"
                variant="landing"
                nativeButton={false}
                render={<Link href="/setup" />}
              >
                Bắt đầu miễn phí ngay
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto grid max-w-[90rem] gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 md:grid-cols-[1fr_auto] md:items-end lg:px-10">
          <div>
            <FinLogo size={30} showText />
            <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
              Giải pháp quản lý tài chính tập trung cho gia đình và nhóm. Minh
              bạch dòng tiền, chủ động ngân sách.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[var(--text-secondary)]">
            <Link
              href="#cach-hoat-dong"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Về Felix
            </Link>
            <Link
              href="#tinh-nang"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Tính năng
            </Link>
            <Link
              href="#bao-mat"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Bảo mật
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[90rem] border-t border-[var(--border)] px-4 py-6 text-xs text-[var(--text-muted)] sm:px-6 lg:px-10">
          © 2026 Felix. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
