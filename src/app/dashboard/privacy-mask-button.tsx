"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/base";
import { togglePrivacyMask, usePrivacyMask } from "@/lib/privacy-mask";
import { cn } from "@/lib/utils";

export function PrivacyMaskHeaderButton() {
  const privacyMasked = usePrivacyMask();

  return (
    <Button
      variant="icon"
      size="icon"
      type="button"
      onClick={togglePrivacyMask}
      aria-label={privacyMasked ? "Hiện số tiền" : "Ẩn số tiền toàn ứng dụng"}
      title={privacyMasked ? "Hiện số tiền" : "Ẩn số tiền toàn ứng dụng"}
      aria-pressed={privacyMasked}
      className={cn(
        privacyMasked &&
          "border-[var(--primary)]/35 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
      )}
    >
      {privacyMasked ? (
        <EyeOff aria-hidden="true" />
      ) : (
        <Eye aria-hidden="true" />
      )}
    </Button>
  );
}
