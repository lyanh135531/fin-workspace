"use client";

import { useState, useTransition, useRef } from "react";
import { KeyRound, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { requestJoinAction } from "@/app/dashboard/join/actions";

export function JoinForm() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(f: FormData) {
    setMessage(null);
    start(async () => {
      const r = await requestJoinAction({ inviteCode: f.get("inviteCode") });
      if (r.ok) {
        setMessage({ ok: true, text: "Đã gửi yêu cầu thành công! Hãy chờ Admin workspace duyệt." });
        formRef.current?.reset();
      } else {
        setMessage({ ok: false, text: r.message ?? "Không thể gửi yêu cầu." });
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

        {message && (
          <div className={`join-form-feedback ${message.ok ? "join-feedback-ok" : "join-feedback-err"}`} role="status">
            {message.ok
              ? <CheckCircle2 size={15} strokeWidth={2} />
              : <AlertCircle size={15} strokeWidth={2} />}
            {message.text}
          </div>
        )}

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
