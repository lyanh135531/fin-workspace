"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/base";
import { AccountSettingsClient } from "@/app/dashboard/settings/account-settings-client";
import { UserRound } from "lucide-react";
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
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="account-settings-sheet w-full sm:max-w-[520px]"
      >
        <SheetHeader className="account-settings-sheet-header">
          <div className="account-settings-sheet-heading">
            <span aria-hidden="true">
              <UserRound size={18} />
            </span>
            <div>
              <SheetTitle>Cài đặt tài khoản</SheetTitle>
              <SheetDescription>
                Hồ sơ cá nhân, mật khẩu và phiên làm việc
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="account-settings-sheet-body">
          <AccountSettingsClient username={username} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
