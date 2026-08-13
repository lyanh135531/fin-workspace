"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/base";
import { AccountSettingsClient } from "@/app/dashboard/settings/account-settings-client";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

export function AccountSettingsModal({
  open,
  onClose,
  username,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement={isMobile ? "edge" : "inset"}
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation={isMobile ? "raised" : "flat"}
        showCloseButton={!isMobile}
        className={isMobile ? "quick-transaction-sheet" : undefined}
      >
        <SheetHeader
          className={
            isMobile
              ? "quick-transaction-header"
              : "px-8 pt-7 pb-[1.4rem]"
          }
        >
          <div
            className={
              isMobile
                ? "quick-transaction-heading"
                : "flex items-center gap-3.5 pr-12"
            }
          >
            <span
              className={
                isMobile
                  ? undefined
                  : "grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              }
              aria-hidden="true"
            >
              <KeyRound size={18} />
            </span>
            <div>
              <SheetTitle
                className={
                  isMobile
                    ? undefined
                    : "text-[1.3rem] font-semibold tracking-[-0.02em]"
                }
              >
                Đổi mật khẩu
              </SheetTitle>
              <SheetDescription
                className={
                  isMobile
                    ? undefined
                    : "mt-1 max-w-[30rem] text-[0.82rem] leading-[1.55]"
                }
              >
                Hồ sơ cá nhân, mật khẩu và phiên làm việc
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div
          className={
            isMobile
              ? "quick-transaction-scroll !p-0"
              : "flex-1 overflow-y-auto overscroll-contain px-8 pt-6 pb-8"
          }
        >
          <AccountSettingsClient username={username} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
