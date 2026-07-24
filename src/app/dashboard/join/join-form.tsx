"use client";

import { useTransition, useRef } from "react";
import { KeyRound, Send, Loader2 } from "lucide-react";
import { requestJoinAction } from "@/app/dashboard/join/actions";
import { Label } from "@/components/ui/label";
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
    <form ref={formRef} action={submit} className="join-form-card">
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
        <Label className="join-form-label" htmlFor="join-invite-code">
          Mã mời Workspace
        </Label>
        <div className="join-form-input-row">
          <input
            id="join-invite-code"
            required
            name="inviteCode"
            className="join-form-input"
            placeholder="Ví dụ: 892-415 hoặc 892415"
            minLength={6}
            maxLength={36}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <button disabled={pending} className="join-form-submit" type="submit">
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
        </button>
      </div>
    </form>
  );
}
