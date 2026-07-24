"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountSettingsClient } from "@/app/dashboard/settings/account-settings-client";

export function AccountSettingsModal({
  open,
  onClose,
  username,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
}) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="account-settings-sheet w-full sm:max-w-[520px]">
        <SheetHeader className="account-settings-sheet-header">
          <SheetTitle>Tài khoản</SheetTitle>
        </SheetHeader>
        <div className="account-settings-sheet-body">
          <AccountSettingsClient username={username} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
