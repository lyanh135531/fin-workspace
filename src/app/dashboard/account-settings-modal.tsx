"use client";

import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/base";
import { AccountSettingsClient } from "@/app/dashboard/settings/account-settings-client";
import { UserRound, X } from "lucide-react";
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
        className={isMobile ? "quick-transaction-sheet" : undefined}
      >
        <SheetHeader
          className={
            isMobile
              ? "quick-transaction-header relative"
              : "relative border-b border-[var(--border)] px-7 py-5"
          }
        >
          <div
            className={
              isMobile
                ? "quick-transaction-heading"
                : "flex items-center gap-3 pr-12"
            }
          >
            <span
              className={
                isMobile
                  ? undefined
                  : "grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              }
              aria-hidden="true"
            >
              <UserRound size={18} />
            </span>
            <div>
              <SheetTitle
                className={
                  isMobile
                    ? undefined
                    : "text-xl font-semibold tracking-[-0.025em]"
                }
              >
                Thông tin tài khoản
              </SheetTitle>
              <SheetDescription
                className={
                  isMobile
                    ? undefined
                    : "mt-1 max-w-[30rem] text-xs leading-5"
                }
              >
                Hồ sơ cá nhân và phương thức đăng nhập
              </SheetDescription>
            </div>
          </div>
          <SheetClose
            render={
              <Button
                variant="icon"
                size="icon"
                className={
                  isMobile
                    ? "absolute right-3 top-4"
                    : "absolute right-5 top-5"
                }
                aria-label="Đóng thông tin tài khoản"
              />
            }
          >
            <X aria-hidden="true" />
          </SheetClose>
        </SheetHeader>
        <div
          className={
            isMobile
              ? "quick-transaction-scroll !p-0"
              : "flex-1 overflow-y-auto overscroll-contain px-7 py-5"
          }
        >
          <AccountSettingsClient username={username} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
