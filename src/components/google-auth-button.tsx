"use client";

import { getProviders, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button, Loading } from "@/components/base";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.77-5.62-4.14H3.03v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.38 13.92A6.02 6.02 0 0 1 6.06 12c0-.67.12-1.32.32-1.92V7.46H3.03A10 10 0 0 0 2 12c0 1.62.39 3.15 1.03 4.54l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.97 5.46l3.35 2.62C7.17 7.71 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

export function GoogleAuthButton({
  callbackUrl = "/auth/google/complete",
  label = "Tiếp tục với Google",
  dividerLabel,
  enabled,
}: {
  callbackUrl?: string;
  label?: string;
  dividerLabel?: string;
  enabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(enabled ?? null);

  useEffect(() => {
    if (enabled !== undefined) return;
    let active = true;
    void getProviders().then((providers) => {
      if (active) setAvailable(Boolean(providers?.google));
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  if (available !== true) return null;

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void signIn("google", { callbackUrl }).catch(() => setPending(false));
        }}
      >
        {pending ? <Loading label="Đang chuyển đến Google..." /> : <><GoogleMark /><span>{label}</span></>}
      </Button>
      {dividerLabel && (
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]" aria-hidden="true">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span>{dividerLabel}</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
      )}
    </div>
  );
}
