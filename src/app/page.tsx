import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  Fingerprint,
  Landmark,
  Layers,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import { APP_ORIGIN } from "@/lib/host-routing";

const siteUrl = "https://felixwise.io.vn";

export const metadata: Metadata = {
  title: {
    absolute: "Felix — Quản lý tài chính cá nhân, gia đình & tích sản",
  },
  description:
    "Theo dõi thu chi, quản lý ví tiền, thẻ tín dụng, sổ tiết kiệm, vàng tích sản và ngân sách 6 hũ trong một không gian tinh gọn, bảo mật.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Felix",
    title: "Felix — Rõ ràng thu chi, vững vàng tích sản",
    description:
      "Quản lý ví tiền, thẻ tín dụng, sổ tiết kiệm, vàng tích sản và ngân sách 6 hũ cho cá nhân & gia đình.",
    images: [
      {
        url: "/felix-open-graph.png",
        width: 1200,
        height: 630,
        alt: "Felix — Không gian quản lý tài chính cá nhân và gia đình",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Felix — Rõ ràng thu chi, vững vàng tích sản",
    description:
      "Quản lý ví tiền, thẻ tín dụng, sổ tiết kiệm, vàng tích sản và ngân sách 6 hũ cho cá nhân & gia đình.",
    images: ["/felix-open-graph.png"],
  },
};

function viMonth(date: Date): string {
  return `Tháng ${date.getMonth() + 1}`;
}

function ddMM(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Felix",
      inLanguage: "vi-VN",
      description:
        "Không gian quản lý thu chi, thẻ tín dụng và tích sản cho cá nhân và gia đình.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#application`,
      name: "Felix",
      applicationCategory: "FinanceApplication",
      applicationSubCategory: "Personal & Family Finance Management",
      operatingSystem: "Web, iOS, Android (PWA)",
      url: siteUrl,
      inLanguage: "vi-VN",
      description:
        "Ứng dụng quản lý thu chi, ví tiền, thẻ tín dụng, sổ tiết kiệm, vàng tích sản và ngân sách 6 hũ.",
    },
  ],
};

const HIGHLIGHTS = [
  {
    code: "01",
    label: "Sổ thu chi & Ví tiền",
    title: "Biết rõ tiền đang ở đâu",
    desc: "Quản lý rõ ràng tiền mặt, tài khoản ngân hàng, ví riêng tư của mỗi người và quỹ chung của cả gia đình.",
  },
  {
    code: "02",
    label: "Thẻ tín dụng & Trả góp",
    title: "Không lo tiêu lẹm tiền trả thẻ",
    desc: "Tự động tách riêng khoản tiền chờ thanh toán thẻ để bạn luôn biết số dư thực sự còn lại cho chi tiêu hàng ngày.",
  },
  {
    code: "03",
    label: "Vàng & Sổ tiết kiệm",
    title: "Theo dõi tích sản sát giá thực tế",
    desc: "Cập nhật giá vàng SJC, nhẫn 9999 tự động hoặc theo tiệm vàng quen; tự động tính lãi sổ tiết kiệm dự kiến.",
  },
  {
    code: "04",
    label: "Ngân sách 6 Hũ",
    title: "Chi tiêu có kế hoạch mỗi tháng",
    desc: "Chia thu nhập vào 6 hũ chi tiêu và theo dõi tiến độ các mục tiêu lớn như mua nhà, mua xe hay lập quỹ dự phòng.",
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: "Bước 01",
    title: "Tạo không gian cho riêng bạn hoặc gia đình",
    description:
      "Bắt đầu quản lý cho riêng bạn ngay lập tức, hoặc mời vợ/chồng và người thân cùng tham gia bằng mã mời 6 số. Bạn tự chọn ví nào dùng chung, ví nào giữ riêng tư.",
    metrics: ["Tạo nhanh trong 30 giây", "Dùng riêng hoặc dùng chung gia đình"],
  },
  {
    step: "Bước 02",
    title: "Thêm ví tiền, thẻ tín dụng và tài sản tích lũy",
    description:
      "Nhập số dư tài khoản ngân hàng, thẻ tín dụng, sổ tiết kiệm hoặc lượng vàng đang cất giữ. Felix tự động tổng hợp tổng tài sản ròng rõ ràng ngay lập tức.",
    metrics: ["Tự động theo dõi kỳ sao kê thẻ", "Tính sẵn giá vốn & lời/lỗ đầu tư"],
  },
  {
    step: "Bước 03",
    title: "Ghi chép thu chi hàng ngày & theo dõi tài sản lớn dần",
    description:
      "Ghi nhanh từng khoản thu chi chỉ trong vài giây trên điện thoại hoặc máy tính. Các hóa đơn định kỳ được nhắc lịch tự động để bạn luôn chủ động dòng tiền.",
    metrics: ["Đồng bộ tức thì trên mọi thiết bị", "Lưu ra màn hình chính điện thoại như ứng dụng"],
  },
] as const;

const SECURITY_PILLARS = [
  {
    icon: LockKeyhole,
    title: "Dữ liệu mỗi nhà hoàn toàn tách biệt",
    desc: "Mỗi nhóm tài chính là một không gian riêng. Không ai bên ngoài có thể xem hay truy cập dữ liệu của gia đình bạn.",
  },
  {
    icon: UsersRound,
    title: "Giữ trọn không gian riêng tư",
    desc: "Ngay cả khi dùng chung với gia đình, bạn vẫn có thể tạo Ví cá nhân hoặc khoản tích lũy riêng mà chỉ mình bạn nhìn thấy.",
  },
  {
    icon: Fingerprint,
    title: "Đăng nhập an toàn & linh hoạt",
    desc: "Hỗ trợ đăng nhập nhanh bằng tài khoản Google hoặc mật khẩu riêng, dễ dàng quản lý các thiết bị đang truy cập.",
  },
  {
    icon: ReceiptText,
    title: "Không quảng cáo, không bán dữ liệu",
    desc: "Felix cam kết không hiển thị quảng cáo và tuyệt đối không chia sẻ thông tin tài chính của bạn cho bất kỳ bên thứ ba nào.",
  },
] as const;

interface ProductCanvasProps {
  currentMonthLabel: string;
  startMonthLabel: string;
  billDueDateLabel: string;
  agoDateLabel: string;
}

function ProductCanvas({
  currentMonthLabel,
  startMonthLabel,
  billDueDateLabel,
  agoDateLabel,
}: ProductCanvasProps) {
  return (
    <figure
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
      aria-label="Giao diện tổng quan tài chính trên Felix"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Top Window Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-secondary)]/35 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <WalletCards className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                Gia đình Minh Anh
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                3 ví tiền · 2 thẻ tín dụng · Sổ tiết kiệm & Vàng
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--success)]">
            <span className="size-1.5 rounded-full bg-[var(--success)]" />
            Đã đồng bộ
          </span>
        </div>

        {/* Primary Net Worth & Cashflow Section */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Tổng tài sản ròng ({currentMonthLabel})
              </span>
              <p className="mt-1 font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-3xl">
                486.500.000{" "}
                <span className="font-sans text-sm font-semibold text-[var(--text-muted)]">
                  ₫
                </span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--income)_12%,var(--surface))] px-2.5 py-1 text-xs font-semibold text-[var(--income)] tabular-nums">
              <ArrowUpRight className="size-3.5" aria-hidden />
              +8,4% tháng này
            </span>
          </div>

          {/* 10-Bar Cashflow Rhythm */}
          <div
            className="mt-4 flex h-14 items-end gap-1.5 sm:h-16 sm:gap-2"
            aria-label="Biểu đồ tăng trưởng tài sản 6 tháng gần nhất"
          >
            {[38, 46, 44, 58, 54, 68, 64, 79, 86, 100].map((height, idx) => (
              <span
                key={`${height}-${idx}`}
                className={`flex-1 rounded-t-sm transition-colors ${
                  idx === 9
                    ? "bg-[var(--primary)]"
                    : idx >= 7
                      ? "bg-[color-mix(in_srgb,var(--primary)_45%,var(--primary-soft))]"
                      : "bg-[var(--primary-soft)]"
                }`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium text-[var(--text-muted)] tabular-nums sm:text-[11px]">
            <span>{startMonthLabel}</span>
            <span>{currentMonthLabel} · Hiện tại</span>
          </div>
        </div>

        {/* 3-Column Portfolio Strip (Hairline Divided, No Nested Box Borders) */}
        <div className="grid grid-cols-1 divide-y divide-[var(--border)] border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Tiền mặt & Ngân hàng</span>
              <WalletCards className="size-3.5 text-[var(--primary)]" aria-hidden />
            </div>
            <strong className="mt-1 block text-xs font-semibold text-[var(--foreground)] tabular-nums sm:text-sm">
              64.200.000 ₫
            </strong>
            <span className="mt-0.5 block text-[10px] text-[var(--text-muted)] tabular-nums">
              Chờ trả thẻ: 8.300.000 ₫
            </span>
          </div>

          <div className="px-4 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Sổ tiết kiệm</span>
              <Landmark className="size-3.5 text-[var(--info)]" aria-hidden />
            </div>
            <strong className="mt-1 block text-xs font-semibold text-[var(--foreground)] tabular-nums sm:text-sm">
              250.000.000 ₫
            </strong>
            <span className="mt-0.5 block text-[10px] text-[var(--income)] tabular-nums">
              +6.450.000 ₫ lãi tạm tính
            </span>
          </div>

          <div className="px-4 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Vàng tích sản</span>
              <Coins className="size-3.5 text-[var(--warning)]" aria-hidden />
            </div>
            <strong className="mt-1 block text-xs font-semibold text-[var(--foreground)] tabular-nums sm:text-sm">
              172.300.000 ₫
            </strong>
            <span className="mt-0.5 block text-[10px] text-[var(--income)] tabular-nums">
              2,0 lượng · +14,2%
            </span>
          </div>
        </div>

        {/* Recent Ledger Rows */}
        <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[var(--foreground)]">
              Giao dịch gần đây
            </span>
            <span className="text-[11px] font-medium text-[var(--primary)]">
              Vừa cập nhật
            </span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--income)_12%,var(--surface))] text-[var(--income)]">
                  <ArrowDownLeft className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-xs font-medium text-[var(--foreground)]">
                    Lương {currentMonthLabel.toLowerCase()}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Ví Vietcombank · Hôm nay
                  </p>
                </div>
              </div>
              <strong className="shrink-0 text-xs font-semibold text-[var(--income)] tabular-nums">
                +42.500.000 ₫
              </strong>
            </div>

            <div className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]">
                  <Coins className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-xs font-medium text-[var(--foreground)]">
                    Mua 5 chỉ vàng nhẫn 9999
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Mua tích sản · {agoDateLabel}
                  </p>
                </div>
              </div>
              <strong className="shrink-0 text-xs font-semibold text-[var(--foreground)] tabular-nums">
                43.100.000 ₫
              </strong>
            </div>
          </div>
        </div>

        {/* Upcoming Recurring Strip */}
        <div className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] px-4 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-2.5 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Repeat2
                className="size-3.5 shrink-0 text-[var(--primary)]"
                aria-hidden
              />
              <span className="break-words font-medium text-[var(--foreground)]">
                Nhắc lịch: Sao kê thẻ & Tiền điện
              </span>
            </div>
            <strong className="shrink-0 font-semibold text-[var(--primary)] tabular-nums">
              Hạn {billDueDateLabel}
            </strong>
          </div>
        </div>
      </div>
    </figure>
  );
}

export default function HomePage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthLabel = viMonth(now);

  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startMonthLabel = viMonth(startDate);

  const billDue =
    now.getDate() < 20
      ? new Date(now.getFullYear(), now.getMonth(), 20)
      : new Date(now.getFullYear(), now.getMonth() + 1, 20);
  const billDueDateLabel = ddMM(billDue);

  const agoDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.max(1, now.getDate() - 4),
  );
  const agoDateLabel = ddMM(agoDate);

  return (
    <main
      id="main-content"
      className="min-h-dvh overflow-x-hidden bg-[var(--background)] pt-14 text-[var(--foreground)] md:pt-16"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      {/* =====================================================================
       * NAVIGATION BAR (Mobile, Tablet & Desktop)
       * =================================================================== */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
        <nav
          className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:h-16 md:px-6 lg:px-8"
          aria-label="Điều hướng chính"
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none"
            aria-label="Felix — Trang chủ"
          >
            <FinLogo size={28} />
            <span className="text-base font-bold tracking-tight text-[var(--foreground)]">
              Felix
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex lg:gap-8">
            <Link
              href="#tinh-nang"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Tính năng
            </Link>
            <Link
              href="#tich-san"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Thẻ & Đầu tư
            </Link>
            <Link
              href="#cach-hoat-dong"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Cách bắt đầu
            </Link>
            <Link
              href="#bao-mat"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Bảo mật
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <ThemeToggle />
            <Link
              href={`${APP_ORIGIN}/sign-in`}
              className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] sm:px-3 sm:text-sm"
            >
              Đăng nhập
            </Link>
            <Button
              size="sm"
              variant="landing"
              nativeButton={false}
              render={<Link href={`${APP_ORIGIN}/setup`} />}
              className="h-9 rounded-lg px-3 text-xs font-semibold sm:px-4 sm:text-sm"
            >
              <span>Tạo tài khoản</span>
            </Button>
          </div>
        </nav>
      </header>

      {/* =====================================================================
       * 1. HERO SECTION — Split 12-Col Editorial + Single-Border Canvas
       * =================================================================== */}
      <section className="relative border-b border-[var(--border)] px-4 pt-7 pb-12 sm:pt-10 sm:pb-16 md:px-6 md:pt-14 md:pb-20 lg:px-8 lg:pt-16 lg:pb-24">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Editorial Value Proposition (Max 4 stack items) */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              <Sparkles className="size-3.5" aria-hidden />
              <span>Tài chính cá nhân & gia đình</span>
            </div>

            <h1 className="mt-4 text-balance font-serif text-3xl font-bold leading-[1.12] tracking-tight text-[var(--foreground)] sm:text-4xl md:mt-5 md:text-5xl lg:text-[3.35rem]">
              Rõ ràng từng khoản chi,{" "}
              <span className="text-[var(--primary)]">vững vàng tích sản.</span>
            </h1>

            <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base md:mt-5 md:text-lg md:leading-8">
              Ghi chép thu chi hàng ngày, biết rõ số tiền chờ trả thẻ tín dụng
              và theo dõi sổ tiết kiệm, vàng tích sản trong một không gian tinh
              gọn, dễ dùng.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center md:mt-8">
              <Button
                size="lg"
                variant="landing"
                nativeButton={false}
                render={<Link href={`${APP_ORIGIN}/setup`} />}
                className="h-11 w-full rounded-xl px-6 text-sm font-semibold sm:w-auto"
              >
                <span>Tạo tài khoản</span>
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Link
                href="#tinh-nang"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] sm:w-auto"
              >
                <span>Khám phá tính năng</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Live Product Preview Canvas */}
          <div className="lg:col-span-6">
            <ProductCanvas
              currentMonthLabel={currentMonthLabel}
              startMonthLabel={startMonthLabel}
              billDueDateLabel={billDueDateLabel}
              agoDateLabel={agoDateLabel}
            />
          </div>
        </div>
      </section>

      {/* =====================================================================
       * 2. ARCHITECTURAL 4-PILLAR STRIP (Zero Card Clutter, Hairline Grid)
       * =================================================================== */}
      <section
        aria-label="4 trụ cột quản lý tài chính"
        className="border-b border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="mx-auto grid max-w-7xl divide-y divide-[var(--border)] px-4 sm:grid-cols-2 sm:divide-y-0 md:px-6 lg:grid-cols-4 lg:divide-x lg:px-8">
          {HIGHLIGHTS.map((item, idx) => (
            <div
              key={item.code}
              className={`py-5 sm:px-4 sm:py-6 lg:px-6 lg:py-8 first:lg:pl-0 last:lg:pr-0 ${
                idx >= 2 ? "sm:border-t sm:border-[var(--border)] lg:border-t-0" : ""
              } ${idx % 2 === 1 ? "sm:border-l sm:border-[var(--border)] lg:border-l" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[var(--primary)]">
                  {item.code}
                </span>
                <span className="rounded-md bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  {item.label}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold tracking-tight text-[var(--foreground)]">
                {item.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
       * 3. ASYMMETRIC BENTO FEATURE SHOWCASE (#tinh-nang & #tich-san)
       * =================================================================== */}
      <section
        id="tinh-nang"
        className="border-b border-[var(--border)] bg-[var(--background)] py-14 sm:py-20 md:py-24"
        aria-labelledby="bento-heading"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Tính năng nổi bật
            </span>
            <h2
              id="bento-heading"
              className="mt-2 text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl md:text-4xl"
            >
              Thiết kế sát với thói quen chi tiêu và tích sản của người Việt
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              Từ việc tách riêng tiền chờ trả thẻ tín dụng, cập nhật giá vàng
              nhẫn theo tiệm quen cho đến quản lý quỹ chung vợ chồng — mọi thứ
              đều rõ ràng, dễ hiểu.
            </p>
          </div>

          {/* Bento Grid: Single-Border Cards with Integrated Hairline Mockup Footers */}
          <div
            id="tich-san"
            className="mt-8 grid gap-4 sm:mt-10 md:gap-6 lg:grid-cols-12"
          >
            {/* BENTO CELL 1 (7 cols): Wallets & Post-paid Credit Card Commitments */}
            <article className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:col-span-7">
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                    <CreditCard className="size-3.5" aria-hidden />
                    Ví tiền & Thẻ tín dụng
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Tách riêng tiền chờ trả thẻ
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl md:text-2xl">
                  Quẹt thẻ tín dụng mà không lo tiêu lẹm vào tiền trả sao kê
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  Mỗi khi chi tiêu bằng thẻ tín dụng, Felix tự động ghi nhận
                  khoản{" "}
                  <strong className="font-semibold text-[var(--foreground)]">
                    Tiền chờ thanh toán thẻ
                  </strong>{" "}
                  trên ví thanh toán mà không trừ thẳng vào số dư ngân hàng —
                  giúp bạn biết ngay số tiền thực sự còn dư để chi tiêu.
                </p>
              </div>

              {/* Integrated Hairline Footer Mockup */}
              <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)]/35">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3.5 sm:px-7">
                  <div>
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      Tài khoản Vietcombank (Ví chính)
                    </span>
                    <p className="mt-0.5 text-base font-bold text-[var(--foreground)] tabular-nums sm:text-lg">
                      42.500.000 ₫
                    </p>
                  </div>
                  <span className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                    Khớp với số dư ngân hàng
                  </span>
                </div>

                <div className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="px-5 py-3.5 sm:px-7">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      Tiền chờ thanh toán thẻ
                    </span>
                    <strong className="mt-1 block text-sm font-semibold text-[var(--warning)] tabular-nums">
                      8.400.000 ₫
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                      2 thẻ tín dụng · Chốt sao kê 20/10
                    </span>
                  </div>

                  <div className="px-5 py-3.5 sm:px-7">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      Còn lại sau khi trừ
                    </span>
                    <strong className="mt-1 block text-sm font-semibold text-[var(--income)] tabular-nums">
                      34.100.000 ₫
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                      Đã trừ tiền chờ thanh toán thẻ
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {/* BENTO CELL 2 (5 cols): Investments (Gold & Bank Savings) */}
            <article className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:col-span-5">
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                    <TrendingUp className="size-3.5" aria-hidden />
                    Đầu tư & Tích sản
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Vàng & Tiết kiệm
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                  Theo dõi Vàng tích sản & Sổ tiết kiệm sát thực tế từng ngày
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  Tự động cập nhật giá vàng SJC, nhẫn 9999 theo thị trường hoặc
                  điều chỉnh chênh lệch theo đúng tiệm vàng bạn mua. Tự động
                  tính lãi sổ tiết kiệm và tổng hợp lời/lỗ rõ ràng.
                </p>
              </div>

              {/* Integrated Hairline Footer Mockup */}
              <div className="divide-y divide-[var(--border)] border-t border-[var(--border)] bg-[var(--surface-secondary)]/35">
                <div className="px-5 py-3.5 sm:px-7">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="size-4 text-[var(--warning)]" aria-hidden />
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        Vàng nhẫn 9999 · 2,0 lượng
                      </span>
                    </div>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--income)_12%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--income)] tabular-nums">
                      +21.400.000 ₫
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                    <span>Giá vốn: 150.900.000 ₫</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      Hiện tại: 172.300.000 ₫
                    </span>
                  </div>
                </div>

                <div className="px-5 py-3.5 sm:px-7">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="size-4 text-[var(--info)]" aria-hidden />
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        Tiết kiệm Techcombank · 12 tháng
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--info)] tabular-nums">
                      5,8% / năm
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                    <span>Gốc: 250.000.000 ₫</span>
                    <span className="font-semibold text-[var(--income)]">
                      +14.500.000 ₫ lãi đáo hạn
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {/* BENTO CELL 3 (5 cols): 6 Jars Financial Plan & Goals */}
            <article className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:col-span-5">
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] px-3 py-1 text-xs font-semibold text-[var(--info)]">
                    <PiggyBank className="size-3.5" aria-hidden />
                    Kế hoạch 6 Hũ & Mục tiêu
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Chi tiêu có kế hoạch
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                  Chia ngân sách 6 hũ & theo dõi các mục tiêu tích lũy
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  Phân bổ thu nhập hàng tháng vào 6 hũ chi tiêu và theo dõi tiến
                  độ từng mục tiêu lớn như lập Quỹ dự phòng, Mua xe hay Mua nhà.
                </p>
              </div>

              {/* 6 Jars Progress Bars */}
              <div className="space-y-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]/35 px-5 py-4 sm:px-7 sm:py-5">
                {[
                  {
                    name: "Nhu cầu thiết yếu (55%)",
                    spent: "14,2 tr / 22,0 tr",
                    pct: 64,
                    color: "bg-[var(--primary)]",
                  },
                  {
                    name: "Tiết kiệm dài hạn (15%)",
                    spent: "6,0 tr / 6,0 tr",
                    pct: 100,
                    color: "bg-[var(--income)]",
                  },
                  {
                    name: "Tự do tài chính & Đầu tư (15%)",
                    spent: "6,0 tr / 6,0 tr",
                    pct: 100,
                    color: "bg-[var(--info)]",
                  },
                ].map((jar) => (
                  <div key={jar.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-[var(--foreground)]">
                        {jar.name}
                      </span>
                      <span className="font-semibold text-[var(--text-secondary)] tabular-nums">
                        {jar.spent}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className={`h-full rounded-full ${jar.color}`}
                        style={{ width: `${jar.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* BENTO CELL 4 (7 cols): Shared Family Workspace + Recurring Transactions */}
            <article className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:col-span-7">
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-3 py-1 text-xs font-semibold text-[var(--success)]">
                    <Layers className="size-3.5" aria-hidden />
                    Gia đình & Nhắc lịch định kỳ
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Dùng chung minh bạch
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl md:text-2xl">
                  Quản lý quỹ chung gia đình mà vẫn giữ trọn sự riêng tư
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  Vợ chồng hoặc các thành viên cùng ghi chép vào{" "}
                  <strong className="font-semibold text-[var(--foreground)]">
                    Ví chung
                  </strong>
                  , trong khi mỗi người vẫn có{" "}
                  <strong className="font-semibold text-[var(--foreground)]">
                    Ví cá nhân riêng
                  </strong>
                  . Đi kèm lịch nhắc tự động cho các khoản chi cố định như tiền
                  nhà, học phí, điện nước mỗi tháng.
                </p>
              </div>

              {/* Integrated Hairline Footer Mockup */}
              <div className="grid grid-cols-1 divide-y divide-[var(--border)] border-t border-[var(--border)] bg-[var(--surface-secondary)]/35 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-4 sm:px-7 sm:py-5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Ví chung & Ví riêng
                  </span>
                  <ul className="mt-2.5 space-y-2 text-xs">
                    <li className="flex items-center justify-between">
                      <span className="text-[var(--foreground)]">
                        Ví sinh hoạt gia đình
                      </span>
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                        Ví chung
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-[var(--foreground)]">
                        Ví tiết kiệm riêng
                      </span>
                      <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        Chỉ mình tôi
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="px-5 py-4 sm:px-7 sm:py-5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Lịch định kỳ hàng tháng
                  </span>
                  <ul className="mt-2.5 space-y-2 text-xs">
                    <li className="flex items-center justify-between tabular-nums">
                      <span className="text-[var(--foreground)]">
                        Tiền nhà · Ngày 05
                      </span>
                      <strong className="font-semibold text-[var(--foreground)]">
                        8.500.000 ₫
                      </strong>
                    </li>
                    <li className="flex items-center justify-between tabular-nums">
                      <span className="text-[var(--foreground)]">
                        Học phí cho con · Ngày 10
                      </span>
                      <strong className="font-semibold text-[var(--foreground)]">
                        4.200.000 ₫
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* =====================================================================
       * 4. HOW IT WORKS — Editorial Split Layout (#cach-hoat-dong)
       * =================================================================== */}
      <section
        id="cach-hoat-dong"
        className="border-b border-[var(--border)] bg-[var(--surface)] py-14 sm:py-20 md:py-24"
        aria-labelledby="workflow-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
          <div className="lg:col-span-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Bắt đầu thật đơn giản
            </span>
            <h2
              id="workflow-heading"
              className="mt-2 text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl md:text-4xl"
            >
              Thiết lập trong vài phút, đồng hành nhiều năm
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              Không yêu cầu liên kết tài khoản ngân hàng hay cung cấp mật khẩu
              Internet Banking. Bạn hoàn toàn chủ động kiểm soát dữ liệu của
              mình.
            </p>

            <div className="mt-6">
              <Button
                size="lg"
                variant="landing"
                nativeButton={false}
                render={<Link href={`${APP_ORIGIN}/setup`} />}
                className="h-11 rounded-xl px-5 text-sm font-semibold"
              >
                <span>Tạo tài khoản</span>
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-7">
            {WORKFLOW_STEPS.map((item) => (
              <article
                key={item.step}
                className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-lg bg-[var(--primary-soft)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--primary)]">
                    {item.step}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {item.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]"
                      >
                        <Check className="size-3 text-[var(--success)]" aria-hidden />
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-[var(--foreground)] sm:text-lg">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
       * 5. SECURITY & PRIVACY ARCHITECTURE (#bao-mat)
       * =================================================================== */}
      <section
        id="bao-mat"
        className="border-b border-[var(--border)] bg-[var(--background)] py-14 sm:py-20 md:py-24"
        aria-labelledby="security-heading"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-5">
              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <ShieldCheck className="size-5" aria-hidden />
              </div>
              <h2
                id="security-heading"
                className="mt-4 text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl md:text-4xl"
              >
                An toàn & riêng tư cho từng gia đình
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                Chuyện tiền bạc luôn cần sự riêng tư tuyệt đối. Tại Felix, dữ
                liệu của mỗi cá nhân và gia đình đều được bảo vệ và tách biệt
                hoàn toàn.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[var(--success)]" aria-hidden />
                  Mã hóa mật khẩu & kết nối an toàn
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[var(--success)]" aria-hidden />
                  Lưu vết lịch sử giao dịch rõ ràng
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:col-span-7">
              {SECURITY_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <h3 className="mt-3.5 text-sm font-bold text-[var(--foreground)] sm:text-base">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                      {pillar.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
       * 6. FINAL CTA — Single-Border Invitation Card
       * =================================================================== */}
      <section
        aria-labelledby="final-cta-heading"
        className="bg-[var(--background)] px-4 py-12 sm:py-16 md:px-6 md:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_5%,var(--surface))] px-5 py-10 text-center sm:px-10 sm:py-14 md:py-16">
            <div className="mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                <Sparkles className="size-3.5" aria-hidden />
                Sẵn sàng sử dụng ngay hôm nay
              </span>

              <h2
                id="final-cta-heading"
                className="mt-4 text-balance font-serif text-2xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-3xl md:text-4xl"
              >
                Bắt đầu quản lý thu chi và tích sản cùng Felix
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)] sm:text-base">
                Tạo tài khoản trong vài giây bằng Google hoặc mật khẩu riêng.
                Theo dõi rõ ràng từng khoản thu chi, thẻ tín dụng, sổ tiết kiệm
                và vàng tích sản.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  variant="landing"
                  nativeButton={false}
                  render={<Link href={`${APP_ORIGIN}/setup`} />}
                  className="h-11 w-full rounded-xl px-6 text-sm font-semibold sm:w-auto"
                >
                  <span>Tạo tài khoản</span>
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Link
                  href={`${APP_ORIGIN}/sign-in`}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] sm:w-auto"
                >
                  Đã có tài khoản? Đăng nhập
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
       * 7. FOOTER
       * =================================================================== */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8 text-xs text-[var(--text-muted)] md:py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-[var(--foreground)]"
              aria-label="Felix — Trang chủ"
            >
              <FinLogo size={26} />
              <span className="text-sm font-bold tracking-tight">Felix</span>
            </Link>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
              Không gian quản lý thu chi, thẻ tín dụng và tích sản tinh gọn dành
              cho cá nhân và gia đình Việt.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2.5 text-xs font-medium text-[var(--text-secondary)]">
            <Link
              href="#tinh-nang"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Tính năng
            </Link>
            <Link
              href="#tich-san"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Thẻ & Đầu tư
            </Link>
            <Link
              href="#cach-hoat-dong"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Cách bắt đầu
            </Link>
            <Link
              href="#bao-mat"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Bảo mật
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Chính sách bảo mật
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Điều khoản sử dụng
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-6 flex max-w-7xl flex-col justify-between gap-2 border-t border-[var(--border)] px-4 pt-6 text-[11px] text-[var(--text-muted)] sm:flex-row sm:items-center md:px-6 lg:px-8">
          <p>© {currentYear} Felix. Mọi quyền được bảo lưu.</p>
          <p>An toàn, riêng tư cho mọi cá nhân và gia đình.</p>
        </div>
      </footer>
    </main>
  );
}
