"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  LogOut,
  ReceiptText,
  Send,
  UserRound,
  WalletCards,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { requestJoinAction } from "@/app/dashboard/join/actions";
import { createPersonalWorkspaceAction } from "@/app/onboarding/actions";
import { PwaInstallBanner } from "@/app/pwa-install";
import { ThemeToggle } from "@/app/theme-toggle";
import { Button, Card, Input, Loading } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";

type OnboardingChoice = "personal" | "join" | null;

type PendingRequest = {
  id: string;
  workspaceName: string;
  createdAt: string;
};

export function OnboardingClient({
  username,
  pendingRequests,
}: {
  username: string;
  pendingRequests: PendingRequest[];
}) {
  const router = useRouter();
  const joinFormRef = useRef<HTMLFormElement>(null);
  const [choice, setChoice] = useState<OnboardingChoice>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();
  const [joining, startJoining] = useTransition();

  function createPersonalWorkspace() {
    setError(null);
    setMessage(null);
    startCreating(async () => {
      const result = await createPersonalWorkspaceAction();
      if (!result.ok) {
        setError(result.message ?? "Không thể tạo không gian cá nhân.");
        return;
      }

      router.replace("/dashboard?action=new-transaction");
      router.refresh();
    });
  }

  function submitJoinRequest(formData: FormData) {
    setError(null);
    setMessage(null);
    startJoining(async () => {
      const result = await requestJoinAction({
        inviteCode: formData.get("inviteCode"),
      });
      if (!result.ok) {
        setError(result.message ?? "Không thể gửi yêu cầu tham gia.");
        return;
      }

      joinFormRef.current?.reset();
      setMessage("Đã gửi yêu cầu. Quản trị viên cần duyệt trước khi bạn có thể truy cập.");
      router.refresh();
    });
  }

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[var(--surface)] text-[var(--foreground)]"
      tabIndex={-1}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3" aria-label="Felix">
          <FinLogo size={34} />
          <span className="text-base font-semibold tracking-[-0.02em]">Felix</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </div>
      </header>

      <PwaInstallBanner />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(32rem,1.2fr)] lg:gap-16 lg:px-8 lg:pb-20 lg:pt-20">
        <section aria-labelledby="onboarding-title" className="lg:pt-5">
          <p className="text-sm font-medium text-[var(--primary)]">Thiết lập lần đầu</p>
          <h1
            id="onboarding-title"
            className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-balance sm:text-4xl lg:text-5xl"
          >
            Bạn muốn bắt đầu với Felix thế nào?
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--text-secondary)]">
            Chào {username}. Chọn mục đích gần nhất với bạn; mọi thiết lập đều có thể thay đổi sau.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface-secondary)] text-[var(--primary)]">
                <WalletCards size={18} aria-hidden="true" />
              </span>
              <p className="pt-1.5">Ví chính và danh mục được chuẩn bị sẵn.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface-secondary)] text-[var(--primary)]">
                <ReceiptText size={18} aria-hidden="true" />
              </span>
              <p className="pt-1.5">Bạn có thể ghi giao dịch đầu tiên ngay sau bước này.</p>
            </div>
          </div>
        </section>

        <section aria-label="Chọn cách bắt đầu" className="space-y-4">
          {pendingRequests.length > 0 && (
            <Card as="aside" size="sm" className="p-5" aria-live="polite">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface-secondary)] text-[var(--warning)]">
                  <Clock3 size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold">Yêu cầu đang chờ duyệt</h2>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                    {pendingRequests.map((request) => (
                      <li key={request.id}>{request.workspaceName}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    Bạn vẫn có thể tạo không gian cá nhân và sử dụng Felix trong lúc chờ.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {choice === null && (
            <div className="grid gap-4">
              <Card as="article" tone="primarySoft" className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--surface)] text-[var(--primary)]">
                    <UserRound size={21} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--primary)]">Khuyên dùng</p>
                    <h2 className="mt-1 text-lg font-semibold">Quản lý tài chính của tôi</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      Tạo không gian cá nhân với Ví chính và các danh mục thu chi phổ biến.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="mt-5 w-full justify-between"
                  onClick={() => setChoice("personal")}
                >
                  Bắt đầu quản lý
                  <ArrowRight aria-hidden="true" />
                </Button>
              </Card>

              <Card as="article" className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                    <KeyRound size={21} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">Tham gia nhóm của tôi</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      Dùng mã mời từ quản trị viên để gửi yêu cầu tham gia nhóm tài chính đã có.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="mt-5 w-full justify-between"
                  onClick={() => setChoice("join")}
                >
                  Tôi có mã mời
                  <ArrowRight aria-hidden="true" />
                </Button>
              </Card>
            </div>
          )}

          {choice === "personal" && (
            <Card as="section" tone="primarySoft" className="p-5 sm:p-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChoice(null);
                  setError(null);
                }}
                disabled={creating}
              >
                <ArrowLeft aria-hidden="true" />
                Chọn cách khác
              </Button>

              <div className="mt-5">
                <p className="text-sm font-medium text-[var(--primary)]">Sẵn sàng trong vài giây</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  Tạo không gian cá nhân
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  Felix sẽ tạo “Tài chính cá nhân”, một Ví chính có số dư ban đầu bằng 0 và các danh mục mặc định.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <CheckCircle2 className="text-[var(--success)]" size={18} aria-hidden="true" />
                <span>Bạn sẽ là quản trị viên của không gian này.</span>
              </div>

              {error && (
                <p className="mt-4 text-sm text-[var(--destructive)]" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="button"
                size="lg"
                className="mt-6 w-full"
                onClick={createPersonalWorkspace}
                disabled={creating}
              >
                {creating ? <Loading label="Đang chuẩn bị..." /> : "Tạo và tiếp tục"}
              </Button>
            </Card>
          )}

          {choice === "join" && (
            <Card as="section" className="p-5 sm:p-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChoice(null);
                  setError(null);
                  setMessage(null);
                }}
                disabled={joining}
              >
                <ArrowLeft aria-hidden="true" />
                Chọn cách khác
              </Button>

              <div className="mt-5">
                <p className="text-sm font-medium text-[var(--primary)]">Tham gia nhóm</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Nhập mã mời</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  Mã gồm 6 số, ví dụ 892-415. Quản trị viên cần duyệt yêu cầu trước khi bạn có thể truy cập.
                </p>
              </div>

              <form
                ref={joinFormRef}
                action={submitJoinRequest}
                className="mt-6 space-y-4"
                aria-busy={joining}
              >
                <Input
                  label="Mã mời"
                  id="onboarding-invite-code"
                  name="inviteCode"
                  required
                  minLength={6}
                  maxLength={36}
                  placeholder="892-415"
                  autoComplete="off"
                  spellCheck={false}
                />

                {error && (
                  <p className="text-sm text-[var(--destructive)]" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="text-sm text-[var(--success)]" role="status">
                    {message}
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={joining}>
                  {joining ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Đang gửi…
                    </>
                  ) : (
                    <>
                      <Send aria-hidden="true" />
                      Gửi yêu cầu tham gia
                    </>
                  )}
                </Button>
              </form>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
