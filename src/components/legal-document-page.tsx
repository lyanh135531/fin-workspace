import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button, Card } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import type { LegalDocument } from "@/domain/legal-policy/policy";

type LegalDocumentPageProps = {
  document: LegalDocument;
  contactEmail: string;
};

export function LegalDocumentPage({
  document,
  contactEmail,
}: LegalDocumentPageProps) {
  const isPrivacy =
    document.title.toLowerCase().includes("bảo mật") ||
    document.title.toLowerCase().includes("privacy");

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]"
      tabIndex={-1}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-4xl items-center justify-between gap-4 px-4 sm:min-h-16 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--primary)]"
              aria-label="Về trang chủ Felix"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Trang chủ</span>
            </Link>
            <span className="text-[var(--border-strong)]">/</span>
            <Link href="/" aria-label="Felix, trang chủ">
              <FinLogo size={24} showText />
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
        {/* Hero Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
              {isPrivacy ? (
                <ShieldCheck className="size-6" aria-hidden="true" />
              ) : (
                <FileText className="size-6" aria-hidden="true" />
              )}
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
                Bản {document.version}
              </span>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Hiệu lực từ {document.effectiveDate}
              </p>
            </div>
          </div>

          <div>
            <h1 className="text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base sm:leading-7">
              {document.summary}
            </p>
          </div>
        </section>

        {/* 4 Core Pillars / Quick Highlights */}
        <section
          aria-label="Tóm tắt cam kết cốt lõi"
          className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3"
        >
          {isPrivacy ? (
            <>
              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Lock className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Phân lập theo nhóm
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Mỗi nhóm được bảo mật độc lập, không rò rỉ.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Không bán dữ liệu
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Tuyệt đối không chia sẻ cho bên thứ ba vì thương mại.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Mã hóa đa tầng
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Mật khẩu băm an toàn, truyền tải qua HTTPS.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <UserCheck className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Toàn quyền kiểm soát
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Dễ dàng yêu cầu chỉnh sửa hoặc xóa dữ liệu.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <FileText className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Quản lý minh bạch
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Hỗ trợ theo dõi ngân sách và thu chi rõ ràng.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <UserCheck className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Phân quyền linh hoạt
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Quản trị viên chủ động quản lý thành viên & vai trò.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Lock className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Bảo mật tài khoản
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Người dùng tự quản lý và bảo vệ mật khẩu cá nhân.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                  Tuân thủ pháp luật
                </h2>
                <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                  Cam kết sử dụng dịch vụ trung thực và hợp pháp.
                </p>
              </div>
            </>
          )}
        </section>

        {/* Detailed Sections */}
        <div className="mt-8 space-y-4 sm:mt-10 sm:space-y-5">
          {document.sections.map((section, index) => (
            <Card
              as="section"
              key={section.title}
              aria-labelledby={`section-${index}`}
              className="gap-3.5 p-4 sm:p-6"
            >
              <h2
                id={`section-${index}`}
                className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg"
              >
                {section.title}
              </h2>

              {section.paragraphs?.map((paragraph, pIdx) => (
                <p
                  key={pIdx}
                  className="text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base sm:leading-7"
                >
                  {paragraph}
                </p>
              ))}

              {section.bullets && (
                <ul className="space-y-2.5 pt-1 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base sm:leading-7">
                  {section.bullets.map((item, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>

        {/* Footer Navigation & Contact */}
        <section
          aria-label="Liên hệ và liên kết bổ sung"
          className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-4 sm:mt-10 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Bạn có câu hỏi hoặc cần hỗ trợ?
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Gửi yêu cầu tới bộ phận phụ trách dữ liệu và chính sách của Felix.
              </p>
            </div>
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--primary)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Mail className="size-4" aria-hidden="true" />
              <span>{contactEmail}</span>
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
            <Link
              href={isPrivacy ? "/terms" : "/privacy"}
              className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
            >
              <span>{isPrivacy ? "Xem Điều khoản sử dụng" : "Xem Chính sách bảo mật"}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Về trang chủ Felix
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
