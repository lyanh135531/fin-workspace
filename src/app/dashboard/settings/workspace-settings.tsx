"use client";

import { AlertTriangle, Building2, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  deleteWorkspaceAction,
  updateWorkspaceSettingsAction,
} from "@/app/dashboard/settings/actions";
import {
  Button,
  Card,
  ConfirmDelete,
  Input,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/base";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Workspace = {
  name: string;
  description: string | null;
  baseCurrency: string;
  timeZone: string;
  status: "active" | "deactive";
};

export function WorkspaceSettings({
  workspace,
  isAdmin,
}: {
  workspace: Workspace;
  isAdmin: boolean;
}) {
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const updateViewport = () => setIsDesktop(query.matches);
    updateViewport();
    query.addEventListener("change", updateViewport);
    return () => query.removeEventListener("change", updateViewport);
  }, []);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const result = await updateWorkspaceSettingsAction({
        name: form.get("name"),
        description: form.get("description") || undefined,
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
        status: form.get("status"),
      });
      if (result.ok) {
        toast.success("Đã lưu cài đặt nhóm.");
      } else {
        toast.error(result.message ?? "Không thể lưu cấu hình.");
      }
    });
  }

  async function remove(): Promise<boolean> {
    if (!confirmPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu tài khoản để xác nhận xóa.");
      return false;
    }
    setDeleting(true);
    try {
      const result = await deleteWorkspaceAction(confirmPassword);
      if (!result.ok) {
        toast.error(result.message ?? "Không thể xóa nhóm tài chính.");
        return false;
      }
      toast.success("Đã xóa nhóm tài chính. Đang chuyển về tổng quan...");
      window.location.assign("/overview");
      return true;
    } finally {
      setDeleting(false);
    }
  }

  function handleDeleteSheetOpenChange(open: boolean) {
    if (!open && deleting) return;
    setDeleteDialog(open);
    if (!open) setConfirmPassword("");
  }

  if (!isAdmin) {
    return (
      <Card
        as="section"
        className="workspace-access-section sunrise-card gap-0 p-6 space-y-2"
      >
        <div className="flex items-center gap-2 text-slate-500">
          <ShieldCheck size={18} />
          <h2 className="text-base font-bold text-[var(--foreground)]">
            Quyền truy cập thành viên
          </h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Chỉ Admin mới có thể chỉnh sửa cấu hình vận hành, quản lý thành viên,
          duyệt yêu cầu tham gia và chia sẻ mã mời.
        </p>
      </Card>
    );
  }

  return (
    <div className="workspace-settings-stack space-y-6 min-[901px]:space-y-5">
      {/* Main configuration */}
      <Card
        as="section"
        className="workspace-config-section relative flex flex-col gap-6 min-[901px]:gap-5"
      >
        <div className="workspace-config-heading flex flex-col justify-between gap-4 md:flex-row md:items-start md:gap-8">
          <div className="flex max-w-xl items-start gap-3">
            <span className="workspace-config-heading-icon" aria-hidden="true">
              <Building2 size={18} strokeWidth={1.8} />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)] min-[901px]:text-base">
                Thông tin chung
              </h2>
              <p className="hidden text-xs leading-5 text-[var(--text-muted)] min-[901px]:block">
                Cập nhật tên, mô tả và trạng thái hoạt động của nhóm.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={save}
          className="space-y-6 min-[901px]:space-y-5"
          aria-busy={pending}
        >
          <div className="grid gap-6 min-[901px]:grid-cols-2 min-[901px]:gap-x-5 min-[901px]:gap-y-4">
            {/* Workspace name */}
            <div className="space-y-2">
              <Input
                label="Tên nhóm"
                id="ws-name"
                required
                name="name"
                defaultValue={workspace.name}
                className="w-full text-base font-semibold"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Select
                label="Trạng thái"
                id="ws-status"
                name="status"
                defaultValue={workspace.status}
                options={[
                  {
                    value: "active",
                    label: (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>Đang hoạt động</span>
                      </span>
                    ),
                  },
                  {
                    value: "deactive",
                    label: (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span>Tạm ngưng</span>
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            {/* Description with character hint */}
            <div className="space-y-2 min-[901px]:col-span-2">
              <Textarea
                label="Mô tả"
                id="ws-desc"
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={workspace.description ?? ""}
                placeholder="Mục đích hoặc phạm vi sử dụng"
                className="settings-textarea w-full text-sm resize-none"
              />
            </div>
          </div>

          <div className="workspace-config-actions flex items-center justify-end border-t border-[var(--border)] pt-5 min-[901px]:pt-4">
            <Button type="submit" disabled={pending} variant="default">
              {pending ? (
                <>
                  <span className="btn-spinner mr-2" aria-hidden />
                  Đang lưu...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger zone */}
      <Card
        as="section"
        className="workspace-danger-section relative p-5 md:p-6"
      >
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/15 dark:text-rose-400">
              <AlertTriangle size={24} strokeWidth={1.9} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-[var(--foreground)]">
                Khu vực nguy hiểm
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                Vô hiệu hóa nhóm tài chính{" "}
                <strong className="font-semibold text-[var(--text-primary)]">
                  {workspace.name}
                </strong>
                . Mọi dữ liệu sẽ bị ẩn và nhóm bị gỡ khỏi danh sách của tất cả
                thành viên.
              </p>
            </div>
          </div>

          <div className="hidden min-[901px]:block">
            <ConfirmDelete
              ariaLabel={`Xóa nhóm tài chính ${workspace.name}`}
              title="Xóa nhóm tài chính?"
              description={
                <>
                  Nhóm <strong>{workspace.name}</strong> sẽ bị vô hiệu hóa và gỡ
                  khỏi danh sách của tất cả thành viên.
                </>
              }
              content={
                <Input
                  label="Mật khẩu tài khoản"
                  id="confirm-password-input-desktop"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  autoComplete="current-password"
                  autoFocus
                />
              }
              confirmLabel="Xác nhận xóa"
              confirmDisabled={!confirmPassword.trim()}
              disabled={pending || deleting}
              onOpenChange={(open) => {
                if (!open) setConfirmPassword("");
              }}
              onConfirm={remove}
              trigger={
                <Button
                  type="button"
                  disabled={pending || deleting}
                  variant="destructive"
                >
                  <Trash2 size={16} />
                  Xóa nhóm
                </Button>
              }
            />
          </div>

          <div className="w-full min-[901px]:hidden">
            <Button
              type="button"
              disabled={pending || deleting}
              onClick={() => {
                setConfirmPassword("");
                setDeleteDialog(true);
              }}
              variant="destructive"
            >
              <Trash2 size={16} className="mr-2" />
              Xóa nhóm
            </Button>
          </div>
        </div>
      </Card>

      {!isDesktop && (
        <Sheet open={deleteDialog} onOpenChange={handleDeleteSheetOpenChange}>
          <SheetContent
            side="bottom"
            className="workspace-delete-sheet ledger-mobile-review-sheet pending-delete w-[min(32rem,calc(100vw-1rem))]! max-w-none! gap-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0"
            aria-label={`Xác nhận xóa nhóm tài chính ${workspace.name}`}
          >
            <SheetHeader className="ledger-mobile-review-header border-b border-[var(--border)] bg-[var(--surface-secondary)]">
              <div className="ledger-mobile-review-heading flex items-center gap-3">
                <span aria-hidden="true">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <SheetTitle>Xóa nhóm tài chính?</SheetTitle>
                  <SheetDescription>
                    Hành động này cần được xác nhận bằng mật khẩu.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="ledger-mobile-review-body grid gap-4 overflow-y-auto p-4">
              <p className="relative text-xs leading-relaxed text-slate-500">
                Nhóm <strong>{workspace.name}</strong> sẽ bị vô hiệu hóa. Để
                tiếp tục, vui lòng xác nhận bằng mật khẩu tài khoản của bạn.
              </p>

              <div className="relative space-y-1.5">
                <Input
                  label="Mật khẩu tài khoản"
                  id="confirm-password-input"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  className="field w-full text-sm font-medium"
                  autoComplete="current-password"
                  autoFocus
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      confirmPassword.trim() &&
                      !deleting
                    ) {
                      event.preventDefault();
                      void remove();
                    }
                  }}
                />
              </div>
            </div>

            <SheetFooter className="ledger-mobile-review-actions grid! grid-cols-2 gap-2 border-t border-[var(--border)] p-4">
              <Button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteSheetOpenChange(false)}
                variant="outline"
                size="default"
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={deleting || !confirmPassword.trim()}
                onClick={() => void remove()}
                variant="destructive"
                size="default"
              >
                {deleting ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang xóa...
                  </>
                ) : (
                  "Xác nhận xóa"
                )}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
