"use client";

import { AlertCircle, ArrowRight, User } from "lucide-react";
import { signIn } from "next-auth/react";
import { useId, useState } from "react";

import { completeGoogleProfileAction } from "@/app/setup/google/actions";
import { Button, Card, Input, Loading } from "@/components/base";

export function GoogleSetupClient({ email }: { email: string }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const username = String(new FormData(event.currentTarget).get("username") ?? "");
    const result = await completeGoogleProfileAction({ username });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    const authenticated = await signIn("google-profile-complete", {
      token: result.token,
      redirect: false,
    });
    if (!authenticated?.ok || authenticated.error) {
      setError("Đã lưu username nhưng chưa làm mới được phiên đăng nhập. Hãy đăng nhập lại bằng Google.");
      setPending(false);
      return;
    }
    window.location.replace("/onboarding");
  }

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center bg-[var(--surface-secondary)] px-4 py-10">
      <Card as="section" className="w-full max-w-md gap-6" aria-labelledby="google-setup-title">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Bước cuối</p>
          <h1 id="google-setup-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Chọn tên đăng nhập Felix
          </h1>
          <p className="mt-2 leading-6 text-[var(--text-secondary)]">
            Google đã xác minh <strong className="font-semibold text-[var(--foreground)]">{email}</strong>. Username dùng để hiển thị trong các nhóm tài chính.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <Input
            id={`${id}-username`}
            name="username"
            label="Tên đăng nhập"
            required
            minLength={3}
            maxLength={80}
            autoComplete="username"
            autoFocus
            placeholder="Ví dụ: anhly"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            startAdornment={<User size={16} aria-hidden="true" />}
          />
          {error && (
            <div id={`${id}-error`} role="alert" className="flex items-start gap-2 text-sm leading-6 text-[var(--destructive)]">
              <AlertCircle className="mt-1 shrink-0" size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loading label="Đang hoàn tất..." /> : <><span>Tiếp tục</span><ArrowRight size={16} aria-hidden="true" /></>}
          </Button>
        </form>
      </Card>
    </main>
  );
}
