"use client";

import { useTransition, useRef } from "react";
import { KeyRound, Send, Loader2 } from "lucide-react";
import { requestJoinAction } from "@/app/dashboard/join/actions";
import { showToast } from "@/components/toast-container";

export function JoinForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(f: FormData) {
    start(async () => {
      const r = await requestJoinAction({ inviteCode: f.get("inviteCode") });
      if (r.ok) {
        showToast("Đã gửi yêu cầu thành công! Hãy chờ Admin workspace duyệt.", "success");
        formRef.current?.reset();
      } else {
        showToast(r.message ?? "Không thể gửi yêu cầu.", "error");
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
        <label className="join-form-label" htmlFor="join-invite-code">
          Mã mời Workspace
        </label>
        <div className="join-form-input-row">
          <input
            id="join-invite-code"
            required
            name="inviteCode"
            className="join-form-input"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            minLength={8}
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
