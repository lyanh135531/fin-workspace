import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  LockKeyhole,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button, Card } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import { APP_ORIGIN } from "@/lib/host-routing";

const siteUrl = "https://felixwise.io.vn";

export const metadata: Metadata = {
  title: { absolute: "Felix — Quản lý tài chính gia đình & nhóm" },
  description:
    "Felix giúp gia đình và nhóm cùng theo dõi ví, thu chi, giao dịch định kỳ và lịch sử số dư trong một không gian chung an toàn, minh bạch.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Felix",
    title: "Felix — Quản lý tài chính chung minh bạch",
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
    title: "Felix — Quản lý tài chính chung",
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
    name: "Tiền nhà tháng 8",
    meta: "Nhà cửa · hôm qua",
    amount: "−8.200.000 ₫",
    type: "expense",
  },
  {
    name: "Đi chợ cuối tuần",
    meta: "Ăn uống · 16/08",
    amount: "−684.000 ₫",
    type: "expense",
  },
] as const;

const principles = [
  {
    number: "01",
    title: "Đồng bộ tức thì trên mọi thiết bị",
    description:
      "Gom toàn bộ dữ liệu từ ghi chép, bảng tính và tin nhắn về một nơi. Rõ ràng người tạo, thời gian và trạng thái duyệt chi.",
  },
  {
    number: "02",
    title: "Phân bổ ví và lịch sử minh bạch",
    description:
      "Tách bạch từng nguồn tiền: ví chung, ví tiết kiệm, tiền mặt. Mọi biến động số dư đều được đối soát chuẩn xác.",
  },
  {
    number: "03",
    title: "Chủ động với lịch thu chi định kỳ",
    description:
      "Lên lịch sẵn cho tiền nhà, hóa đơn điện nước và quỹ định kỳ. Hệ thống thông báo nhắc hạn giúp luôn chủ động dòng tiền.",
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
      className="relative mx-auto w-full max-w-sm sm:max-w-xl lg:max-w-none"
      aria-label="Bản xem trước không gian tài chính Felix"
    >
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] blur-2xl sm:-inset-10 sm:blur-3xl"
        aria-hidden
      />
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
              <WalletCards className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Nhà của bạn
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                3 ví · 4 thành viên
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--success)_10%,var(--surface))] px-2.5 py-1 text-xs font-medium text-[var(--success)]">
            <span className="size-1.5 rounded-full bg-[var(--success)]" />
            <span>Đã đồng bộ</span>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Tổng số dư khả dụng
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-4xl">
                48.620.500{" "}
                <span className="text-base font-normal text-[var(--text-muted)]">
                  ₫
                </span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2 py-1 text-xs font-semibold text-[var(--success)]">
              +6,8%
            </span>
          </div>
          <div
            className="mt-4 flex h-16 items-end gap-1.5 sm:mt-6 sm:h-20 sm:gap-2"
            aria-label="Biểu đồ dòng tiền gần đây"
          >
            {[35, 48, 42, 65, 55, 78, 68, 92, 75, 95, 84, 110].map(
              (height, index) => (
                <span
                  key={`${height}-${index}`}
                  className={`flex-1 rounded-t-sm transition-all sm:rounded-t-md ${
                    index === 11
                      ? "bg-[var(--primary)]"
                      : "bg-[var(--primary-soft)] hover:bg-[color-mix(in_srgb,var(--primary)_40%,var(--primary-soft))]"
                  }`}
                  style={{ height: `${(height / 110) * 100}%` }}
                />
              ),
            )}
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-medium text-[var(--text-muted)] sm:text-xs">
            <span>Tháng 3</span>
            <span>Tháng 8 (Hiện tại)</span>
          </div>
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3 sm:px-6 sm:py-3.5">
          <div className="grid grid-cols-3 gap-2 text-left">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:p-2.5">
              <span className="block truncate text-[10px] text-[var(--text-muted)] sm:text-xs">
                Ví gia đình
              </span>
              <strong className="block text-xs font-semibold text-[var(--foreground)] tabular-nums sm:text-sm">
                28,4 tr
              </strong>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:p-2.5">
              <span className="block truncate text-[10px] text-[var(--text-muted)] sm:text-xs">
                Tiết kiệm
              </span>
              <strong className="block text-xs font-semibold text-[var(--foreground)] tabular-nums sm:text-sm">
                16,0 tr
              </strong>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:p-2.5">
              <span className="block truncate text-[10px] text-[var(--text-muted)] sm:text-xs">
                Tiền mặt
              </span>
              <strong className="block text-xs font-semibold text-[var(--foreground)] tabular-nums sm:text-sm">
                4,2 tr
              </strong>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              Giao dịch gần đây
            </p>
            <span className="text-[11px] font-medium text-[var(--primary)]">
              Thời gian thực
            </span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {transactions.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--foreground)]">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {item.meta}
                  </p>
                </div>
                <strong
                  className={`shrink-0 text-xs font-semibold tabular-nums ${
                    item.type === "income"
                      ? "text-[var(--income)]"
                      : "text-[var(--expense)]"
                  }`}
                >
                  {item.amount}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Highlight Banner */}
        <div className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] p-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Repeat2 className="size-4 shrink-0 text-[var(--primary)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                Tiền điện sắp tới hạn · 20/08
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[var(--foreground)] tabular-nums">
              1.240.000 ₫
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="min-h-dvh overflow-x-hidden bg-[var(--background)] pt-14 sm:pt-16 text-[var(--foreground)]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      {/* Navigation Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
        <nav
          className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:min-h-16 sm:px-6 lg:px-8"
          aria-label="Điều hướng chính"
        >
          <Link href="/" aria-label="Felix, trang chủ">
            <FinLogo size={30} showText />
          </Link>

          <div className="hidden items-center gap-6 md:flex lg:gap-8">
            <Link
              href="#cach-hoat-dong"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Cách hoạt động
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
            <Link
              href="/privacy"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Chính sách
            </Link>
            <Link
              href="/terms"
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
            >
              Điều khoản
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href={`${APP_ORIGIN}/sign-in`}
              className="inline-flex min-h-9 items-center px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)] sm:text-sm sm:px-3"
            >
              Đăng nhập
            </Link>
            <Button
              size="sm"
              variant="landing"
              nativeButton={false}
              render={<Link href={`${APP_ORIGIN}/setup`} />}
              className="sm:h-9 sm:px-4"
            >
              <span>Bắt đầu ngay</span>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-6 pb-12 sm:px-6 sm:pt-12 sm:pb-20 lg:px-8 lg:pt-16 lg:pb-28">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              <Sparkles className="size-3.5" aria-hidden />
              <span>Quản lý tài chính nhóm & gia đình</span>
            </div>

            <h1 className="mt-4 text-balance font-serif text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:mt-6 sm:text-5xl lg:text-6xl">
              Rõ ràng thu chi,{" "}
              <span className="text-[var(--primary)]">an tâm quản lý</span>
            </h1>

            <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--text-secondary)] sm:mt-5 sm:text-lg sm:leading-8">
              Theo dõi tiền đang ở đâu, đã chi vào việc gì. Đồng bộ ví chung, kiểm soát
              ngân sách và tự động hóa các khoản chi định kỳ trên một giao diện tinh tế.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-start">
              <Button
                size="lg"
                variant="landing"
                nativeButton={false}
                render={<Link href={`${APP_ORIGIN}/setup`} />}
                className="w-full sm:w-auto"
              >
                Trải nghiệm miễn phí
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Link
                href="#tinh-nang"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] sm:w-auto"
              >
                <span>Khám phá tính năng</span>
                <ChevronRight className="size-4 text-[var(--text-muted)]" aria-hidden />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 text-left text-xs text-[var(--text-muted)] sm:mt-8 sm:flex sm:flex-wrap sm:gap-5">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-[var(--success)]" aria-hidden />
                Miễn phí bắt đầu
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-[var(--success)]" aria-hidden />
                Không cần thẻ ngân hàng
              </span>
              <span className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
                <Check className="size-3.5 text-[var(--success)]" aria-hidden />
                Đồng bộ đa thiết bị
              </span>
            </div>
          </div>

          <div className="mt-2 lg:mt-0">
            <ProductCanvas />
          </div>
        </div>
      </section>

      {/* 3 Value Pillars */}
      <section
        className="border-y border-[var(--border)] bg-[var(--surface)] py-6 sm:py-10"
        aria-label="Giá trị nổi bật"
      >
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 md:gap-6 lg:px-8">
          {[
            {
              step: "01",
              title: "Tập trung dữ liệu",
              desc: "Gom tất cả giao dịch từ tin nhắn, bảng tính rời rạc về một nơi duy nhất.",
            },
            {
              step: "02",
              title: "Phân quyền linh hoạt",
              desc: "Mọi thành viên đều có thể nhập liệu, người quản trị nắm trọn quyền duyệt chi.",
            },
            {
              step: "03",
              title: "Minh bạch tuyệt đối",
              desc: "Truy xuất lịch sử biến động số dư và các khoản chi mọi lúc, mọi nơi.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4 sm:p-5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                {item.step}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)] sm:text-sm">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="cach-hoat-dong"
        className="bg-[var(--background)] py-14 sm:py-24"
        aria-labelledby="how-it-works-title"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Cách thức hoạt động
            </span>
            <h2
              id="how-it-works-title"
              className="mt-2 text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl"
            >
              Quản lý dòng tiền đơn giản & chuẩn xác
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-xs text-[var(--text-secondary)] sm:text-base">
              Thiết lập không gian tài chính và bắt đầu cộng tác chỉ với 3 bước tinh gọn.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
            {principles.map((item) => (
              <Card
                key={item.number}
                className="relative gap-3 p-5 sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-[var(--primary)]">
                    {item.number}
                  </span>
                  <span className="size-2 rounded-full bg-[var(--primary)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Section */}
      <section
        id="tinh-nang"
        className="border-t border-[var(--border)] bg-[var(--surface)] py-14 sm:py-24"
        aria-labelledby="features-title"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Tính năng cốt lõi
            </span>
            <h2
              id="features-title"
              className="mt-2 text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl"
            >
              Đủ tính năng mạnh mẽ, trải nghiệm tối giản
            </h2>
            <p className="mt-2 max-w-2xl text-xs text-[var(--text-secondary)] sm:text-base">
              Mọi công cụ được thiết kế để bạn nắm trọn bức tranh tài chính mà không bị rối mắt.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Multi-wallets */}
            <Card className="gap-3 p-5 sm:p-7">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <WalletCards className="size-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
                Quản lý đa ví linh hoạt
              </h3>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                Theo dõi riêng biệt ví gia đình, quỹ dự phòng, tiền mặt hay tài khoản chung với số dư cập nhật tức thì.
              </p>
              <div className="mt-2 rounded-xl bg-[var(--surface-secondary)] p-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-[var(--text-muted)]">Ví chi tiêu</span>
                  <span className="font-semibold text-[var(--foreground)]">28.420.000 ₫</span>
                </div>
              </div>
            </Card>

            {/* Feature 2: Recurring Schedules */}
            <Card className="gap-3 p-5 sm:p-7">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Repeat2 className="size-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
                Lên lịch chi tiêu định kỳ
              </h3>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                Đặt lịch tự động cho tiền nhà, điện nước, internet hoặc học phí để không bao giờ quên hạn thanh toán.
              </p>
              <div className="mt-2 rounded-xl bg-[var(--surface-secondary)] p-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-[var(--text-muted)]">Nhắc hạn định kỳ</span>
                  <span className="font-semibold text-[var(--primary)]">Tự động báo trước</span>
                </div>
              </div>
            </Card>

            {/* Feature 3: Roles & Permissions */}
            <Card className="gap-3 p-5 sm:p-7 sm:col-span-2 lg:col-span-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <UsersRound className="size-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
                Phân quyền theo nhóm
              </h3>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                Mỗi nhóm có phân quyền rõ ràng: Quản trị viên duyệt chi, thành viên cập nhật biến động nhanh chóng.
              </p>
              <div className="mt-2 rounded-xl bg-[var(--surface-secondary)] p-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-[var(--text-muted)]">Phân quyền</span>
                  <span className="font-semibold text-[var(--success)]">Admin / Member</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section
        id="bao-mat"
        className="bg-[var(--background)] py-14 sm:py-24"
        aria-labelledby="security-title"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
                <ShieldCheck className="size-6" aria-hidden />
              </div>
              <h2
                id="security-title"
                className="mt-4 text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl"
              >
                Không gian tài chính độc lập & bảo mật
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-base sm:leading-7">
                Felix áp dụng tiêu chuẩn bảo mật phân lập dữ liệu nghiêm ngặt. Thông tin và lịch sử số dư của gia đình hay nhóm bạn luôn được bảo vệ an toàn.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5">
                <LockKeyhole className="size-4 text-[var(--primary)] sm:size-5" aria-hidden />
                <h3 className="mt-2 text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Phân lập theo nhóm
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Dữ liệu từng nhóm hoàn toàn riêng biệt.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5">
                <CheckCircle2 className="size-4 text-[var(--primary)] sm:size-5" aria-hidden />
                <h3 className="mt-2 text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Không bán dữ liệu
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Tuyệt đối không chia sẻ cho bên thứ ba.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5">
                <Fingerprint className="size-4 text-[var(--primary)] sm:size-5" aria-hidden />
                <h3 className="mt-2 text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Mã hóa đa lớp
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Mật khẩu băm an toàn, truyền tải qua HTTPS.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5">
                <ReceiptText className="size-4 text-[var(--primary)] sm:size-5" aria-hidden />
                <h3 className="mt-2 text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Nhật ký minh bạch
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Lưu trữ vết giao dịch để dễ đối chiếu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-[var(--foreground)] p-6 text-center text-[var(--background)] sm:p-14 lg:p-20">
            <div
              className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--primary)_35%,transparent)] blur-3xl"
              aria-hidden
            />
            <div className="relative z-10 mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                <Sparkles className="size-3.5" aria-hidden />
                Bắt đầu hoàn toàn miễn phí
              </span>
              <h2 className="mt-4 font-serif text-2xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Sẵn sàng làm chủ tài chính chung cùng Felix?
              </h2>
              <p className="mt-3 text-xs leading-relaxed opacity-80 sm:text-base">
                Tạo ví chung, mời thành viên và bắt đầu theo dõi dòng tiền minh bạch chỉ trong 2 phút.
              </p>
              <div className="mt-6 flex justify-center">
                <Button
                  size="lg"
                  variant="landing"
                  nativeButton={false}
                  render={<Link href={`${APP_ORIGIN}/setup`} />}
                  className="w-full sm:w-auto"
                >
                  Bắt đầu miễn phí ngay
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8 text-xs text-[var(--text-muted)] sm:py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <FinLogo size={28} showText />
            <p className="mt-2 text-[var(--text-secondary)]">
              Giải pháp theo dõi thu chi và quản lý tài chính nhóm & gia đình.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-medium text-[var(--text-secondary)]">
            <Link href="#cach-hoat-dong" className="hover:text-[var(--foreground)]">
              Cách hoạt động
            </Link>
            <Link href="#tinh-nang" className="hover:text-[var(--foreground)]">
              Tính năng
            </Link>
            <Link href="#bao-mat" className="hover:text-[var(--foreground)]">
              Bảo mật
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)]">
              Chính sách bảo mật
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">
              Điều khoản
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-7xl border-t border-[var(--border)] px-4 pt-6 sm:px-6 lg:px-8">
          <p>© 2026 Felix. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
