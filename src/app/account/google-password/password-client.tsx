"use client";

import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

import { setGoogleVerifiedPasswordAction } from "@/app/account/google-password/actions";
import { Button, Card, Input, Loading } from "@/components/base";

export function GooglePasswordClient() {
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không trùng khớp.");
      setPending(false);
      return;
    }
    const result = await setGoogleVerifiedPasswordAction({ password });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    window.location.replace("/overview?password=created");
  }

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center bg-[var(--surface-secondary)] px-4 py-10">
      <Card as="section" className="w-full max-w-md gap-6" aria-labelledby="password-title">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Đã xác minh Google</p>
          <h1 id="password-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Tạo mật khẩu Felix</h1>
          <p className="mt-2 leading-6 text-[var(--text-secondary)]">Sau bước này, bạn có thể đăng nhập bằng username hoặc Google.</p>
        </header>
        <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
          <Input
            label="Mật khẩu mới"
            name="password"
            type={show ? "text" : "password"}
            minLength={8}
            maxLength={128}
            required
            autoComplete="new-password"
            startAdornment={<Lock size={16} aria-hidden="true" />}
            endAdornment={
              <Button type="button" variant="icon" size="icon" aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow((value) => !value)}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            }
          />
          <Input label="Xác nhận mật khẩu" name="confirmation" type={show ? "text" : "password"} minLength={8} maxLength={128} required autoComplete="new-password" />
          {error && <div role="alert" className="flex items-start gap-2 text-sm leading-6 text-[var(--destructive)]"><AlertCircle className="mt-1 shrink-0" size={16} aria-hidden="true" /><span>{error}</span></div>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loading label="Đang tạo mật khẩu..." /> : "Tạo mật khẩu"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
