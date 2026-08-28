"use client";

import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Lock,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { useId, useState } from "react";

import { acceptCurrentLegalDocumentsAction } from "@/app/consent/actions";
import { Button, Card, Checkbox, Label, Loading } from "@/components/base";
import { getPostConsentPath, MARKETING_HOSTNAME } from "@/lib/host-routing";

type ConsentClientProps = {
  session: Session;
  privacyVersion: string;
  termsVersion: string;
  effectiveDate: string;
  callbackUrl?: string;
};

export function ConsentClient({ session, ...props }: ConsentClientProps) {
  return (
    <SessionProvider session={session}>
      <ConsentForm {...props} />
    </SessionProvider>
  );
}

function ConsentForm({
  privacyVersion,
  termsVersion,
  effectiveDate,
  callbackUrl,
}: Omit<ConsentClientProps, "session">) {
  const checkboxId = useId();
  const { update } = useSession();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!accepted || loading || declining) return;
    setLoading(true);
    setError(null);

    const result = await acceptCurrentLegalDocumentsAction();
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    const refreshed = await update({});
    if (!refreshed?.user?.legalConsentSatisfied) {
      setError("Đã lưu xác nhận nhưng chưa làm mới được phiên. Hãy thử lại.");
      setLoading(false);
      return;
    }

    window.location.replace(
      getPostConsentPath(
        window.location.hostname,
        callbackUrl,
        window.location.origin,
      ),
    );
  }

  async function decline() {
    setDeclining(true);
    setError(null);
    await signOut({ redirect: false });
    window.location.replace(`https://${MARKETING_HOSTNAME}/privacy`);
  }

  return (
    <Card
      as="section"
      className="w-full max-w-lg gap-5 p-5 sm:gap-6 sm:p-7"
      aria-labelledby="consent-title"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_25%,transparent)]">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
            Quyền riêng tư & Điều khoản
          </span>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Hiệu lực từ {effectiveDate}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h1
          id="consent-title"
          className="text-balance font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl"
        >
          Xác nhận trước khi tiếp tục
        </h1>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
          Vui lòng xác nhận đồng ý với Điều khoản và Chính sách bảo mật mới để
          Felix bảo vệ tốt nhất cho dữ liệu của bạn.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 sm:p-4">
        <div className="space-y-2.5 text-xs text-[var(--text-secondary)] sm:text-sm">
          <div className="flex items-center gap-2.5">
            <Lock
              className="size-4 shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>Dữ liệu thu chi được mã hóa và bảo mật an toàn.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck
              className="size-4 shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>
              Dễ dàng xem lại điều khoản bất kỳ lúc nào trong Cài đặt.
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
        <Label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed sm:text-sm"
        >
          <Checkbox
            id={checkboxId}
            checked={accepted}
            disabled={loading || declining}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            className="mt-0.5"
          />
          <span className="text-[var(--foreground)]">
            Tôi đã đọc và đồng ý với{" "}
            <Link
              className="inline-flex items-center gap-0.5 font-semibold text-[var(--primary)] underline decoration-[var(--primary)]/30 underline-offset-4 hover:decoration-[var(--primary)]"
              href="/privacy"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
            >
              Chính sách bảo mật
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>{" "}
            và{" "}
            <Link
              className="inline-flex items-center gap-0.5 font-semibold text-[var(--primary)] underline decoration-[var(--primary)]/30 underline-offset-4 hover:decoration-[var(--primary)]"
              href="/terms"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
            >
              Điều khoản sử dụng
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
            .
          </span>
        </Label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] p-3 text-sm leading-5 text-[var(--danger)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-3">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!accepted || loading || declining}
          onClick={accept}
        >
          {loading ? (
            <Loading label="Đang lưu xác nhận..." />
          ) : (
            <>
              Đồng ý và tiếp tục
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={loading || declining}
          onClick={decline}
        >
          {declining ? (
            <Loading label="Đang đăng xuất..." />
          ) : (
            <>
              <LogOut className="size-4" aria-hidden="true" />
              Từ chối
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
