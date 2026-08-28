"use client";

import { AlertCircle, ArrowRight, FileText, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useId, useState } from "react";

import { acceptCurrentLegalDocumentsAction } from "@/app/consent/actions";
import { Button, Card, Checkbox, Label, Loading } from "@/components/base";
import { getPostConsentPath, MARKETING_HOSTNAME } from "@/lib/host-routing";

type ConsentClientProps = {
  privacyVersion: string;
  termsVersion: string;
  effectiveDate: string;
  callbackUrl?: string;
};

export function ConsentClient({
  privacyVersion,
  termsVersion,
  effectiveDate,
  callbackUrl,
}: ConsentClientProps) {
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
    <Card as="section" className="w-full max-w-2xl gap-6" aria-labelledby="consent-title">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <ShieldCheck className="size-6" aria-hidden="true" />
      </div>

      <div>
        <p className="text-sm font-semibold text-[var(--primary)]">
          Cập nhật quyền riêng tư
        </p>
        <h1
          id="consent-title"
          className="mt-2 text-balance font-serif text-3xl font-bold tracking-[-0.04em] sm:text-4xl"
        >
          Xác nhận trước khi tiếp tục
        </h1>
        <p className="mt-4 max-w-[60ch] text-base leading-7 text-[var(--text-secondary)]">
          Felix cần bạn xác nhận cách dữ liệu được xử lý và các điều kiện sử dụng
          dịch vụ. Bạn có thể đọc toàn văn trước khi quyết định.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/privacy"
          target="_blank"
          className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <FileText className="size-5 text-[var(--primary)]" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Chính sách bảo mật</span>
            <span className="block text-xs text-[var(--text-muted)]">
              Bản {privacyVersion}
            </span>
          </span>
        </Link>
        <Link
          href="/terms"
          target="_blank"
          className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <FileText className="size-5 text-[var(--primary)]" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Điều khoản sử dụng</span>
            <span className="block text-xs text-[var(--text-muted)]">
              Bản {termsVersion}
            </span>
          </span>
        </Link>
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Ngày hiệu lực: {effectiveDate}
      </p>

      <Label
        htmlFor={checkboxId}
        className="min-h-12 cursor-pointer items-start gap-3 text-base leading-6"
      >
        <Checkbox
          id={checkboxId}
          checked={accepted}
          disabled={loading || declining}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          className="mt-1"
        />
        <span>
          Tôi đã đọc và đồng ý với{" "}
          <Link className="font-medium text-[var(--primary)] underline" href="/privacy" target="_blank">
            Chính sách bảo mật
          </Link>{" "}
          và{" "}
          <Link className="font-medium text-[var(--primary)] underline" href="/terms" target="_blank">
            Điều khoản sử dụng
          </Link>
          .
        </span>
      </Label>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] p-3 text-sm leading-6 text-[var(--danger)]"
        >
          <AlertCircle className="mt-1 size-4" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Button
          size="lg"
          disabled={!accepted || loading || declining}
          onClick={accept}
        >
          {loading ? (
            <Loading label="Đang lưu xác nhận..." />
          ) : (
            <>
              Đồng ý và tiếp tục
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={loading || declining}
          onClick={decline}
        >
          {declining ? <Loading label="Đang đăng xuất..." /> : <><LogOut aria-hidden="true" />Không đồng ý</>}
        </Button>
      </div>
    </Card>
  );
}
