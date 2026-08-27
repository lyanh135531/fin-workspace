"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/base";
import {
  AccountSettingsClient,
  ChangePasswordSheet,
  GoogleConfirmSheet,
} from "@/app/dashboard/settings/account-settings-client";
import { UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type AccountSettingsView =
  | "main"
  | "password"
  | "google_link"
  | "google_replace"
  | "google_unlink";

/** Duration (ms) to wait between closing child sheet and opening parent */
const BACK_TRANSITION_DELAY = 80;

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
  const [activeView, setActiveView] = useState<AccountSettingsView>("main");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  // Reset to main view whenever modal is re-opened
  useEffect(() => {
    if (open) {
      setActiveView("main");
      setIsTransitioning(false);
    }
  }, [open]);

  // Clean up transition timer
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  /**
   * Staggered back navigation:
   * 1. Close child sheet (activeView → "main" closes child)
   * 2. Block parent from opening immediately (isTransitioning)
   * 3. After BACK_TRANSITION_DELAY, unblock parent
   */
  const handleBackToMain = useCallback(() => {
    setIsTransitioning(true);
    setActiveView("main");

    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, BACK_TRANSITION_DELAY);
  }, []);

  const isMainOpen = open && activeView === "main" && !isTransitioning;
  const isPasswordOpen = open && activeView === "password";
  const isGoogleOpen = open && activeView.startsWith("google_");
  const googleMode = activeView.startsWith("google_")
    ? (activeView.replace("google_", "") as "link" | "replace" | "unlink")
    : null;

  return (
    <>
      {/* Persistent overlay during back transition to prevent background flash */}
      {isTransitioning && (
        <div
          className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
          aria-hidden="true"
        />
      )}

      {/* ── Main Sheet: Profile & Settings List ──────── */}
      <Sheet
        open={isMainOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          placement="inset"
          size={isMobile ? "default" : "wide"}
          spacing="flush"
          elevation={isMobile ? "raised" : "flat"}
        >
          <SheetHeader className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
                aria-hidden="true"
              >
                <UserRound size={18} />
              </span>
              <div className="min-w-0">
                <SheetTitle>Thông tin tài khoản</SheetTitle>
                <SheetDescription className="text-xs text-[var(--text-muted)]">
                  Quản lý thông tin cá nhân và bảo mật
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-8 sm:px-6 sm:py-5">
            <AccountSettingsClient
              username={username}
              onOpenPasswordChange={() => setActiveView("password")}
              onOpenGoogleAction={(mode) => setActiveView(`google_${mode}`)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ChangePasswordSheet
        open={isPasswordOpen}
        isMobile={isMobile}
        onBack={handleBackToMain}
        onClose={onClose}
      />

      {googleMode && (
        <GoogleConfirmSheet
          open={isGoogleOpen}
          mode={googleMode}
          isMobile={isMobile}
          onBack={handleBackToMain}
          onClose={onClose}
        />
      )}
    </>
  );
}
