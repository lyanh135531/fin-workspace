"use client";

import { useRef, useTransition } from "react";
import { KeyRound, Loader2, Send } from "lucide-react";

import { requestJoinAction } from "@/app/dashboard/join/actions";
import { Button, Card, FormPendingSkeleton, Input } from "@/components/base";
import { toast } from "sonner";

export function JoinForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(f: FormData) {
    start(async () => {
      const r = await requestJoinAction({ inviteCode: f.get("inviteCode") });
      if (r.ok) {
        toast.success("Đã gửi yêu cầu. Hãy chờ quản trị viên workspace duyệt.");
        formRef.current?.reset();
      } else {
        toast.error(r.message ?? "Không thể gửi yêu cầu.");
      }
    });
  }

  return (
    <Card
      as="form"
      ref={formRef}
      action={submit}
      className="gap-0 p-0"
      aria-busy={pending}
    >
      <header className="flex items-start gap-4 border-b border-[var(--border)] p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <KeyRound size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--primary)]">
            Lời mời riêng tư
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Nhập mã mời
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
            Mã mời xác định workspace bạn muốn tham gia. Kiểm tra kỹ mã trước
            khi gửi yêu cầu.
          </p>
        </div>
      </header>

      <div className="grid gap-5 p-6">
        {pending && <FormPendingSkeleton label="Đang gửi yêu cầu tham gia" />}
        <Input
          label="Mã mời workspace"
          id="join-invite-code"
          required
          name="inviteCode"
          placeholder="892-415"
          minLength={6}
          maxLength={36}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="join-invite-code-hint"
        />
        <p
          id="join-invite-code-hint"
          className="-mt-3 text-xs leading-relaxed text-[var(--text-muted)]"
        >
          Có thể nhập mã có hoặc không có dấu gạch ngang.
        </p>

        <Button size="default" disabled={pending} type="submit">
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Đang gửi…
            </>
          ) : (
            <>
              <Send size={15} />
              Gửi yêu cầu tham gia
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
