"use client";

import { Button, Card, FormPendingSkeleton, Input } from "@/components/base";
import { useTransition, useRef } from "react";
import { KeyRound, Send, Loader2 } from "lucide-react";
import { requestJoinAction } from "@/app/dashboard/join/actions";
import { toast } from "sonner";

export function JoinForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(f: FormData) {
    start(async () => {
      const r = await requestJoinAction({ inviteCode: f.get("inviteCode") });
      if (r.ok) {
        toast.success("Đã gửi yêu cầu thành công! Hãy chờ Admin workspace duyệt.");
        formRef.current?.reset();
      } else {
        toast.error(r.message ?? "Không thể gửi yêu cầu.");
      }
    });
  }

  return (
    <Card as="form" ref={formRef} action={submit} className="join-form-card gap-0 py-0" aria-busy={pending}>
      {pending && <FormPendingSkeleton label="Đang gửi yêu cầu tham gia" className="mx-6 mt-3" />}
      <div className="join-form-header">
        <div className="join-form-icon-wrap">
          <KeyRound size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h2>Nhập mã mời</h2>
          <p>
            Dán mã mời do Admin workspace chia sẻ cho bạn.
            Admin sẽ xét duyệt yêu cầu trước khi bạn có quyền hoạt động.
          </p>
        </div>
      </div>

      <div className="join-form-body">
        <div className="join-form-input-row mt-2">
          <Input
            label="Mã mời Workspace"
            id="join-invite-code"
            required
            name="inviteCode"
            className="join-form-input"
            placeholder="892-415 hoặc 892415"
            minLength={6}
            maxLength={36}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <Button variant="unstyled" size="auto" disabled={pending} className="join-form-submit" type="submit">
          {pending ? (
            <>
              <Loader2 size={16} className="ws-join-spinner" />
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
