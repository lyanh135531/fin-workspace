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
  id?: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  timeZone: string;
  status: "active" | "deactive";
};

export function WorkspaceSettings({
  workspace,
  isAdmin,
  workspaceId,
}: {
  workspace: Workspace;
  isAdmin: boolean;
  workspaceId?: string;
}) {
  const resolvedWorkspaceId = workspaceId ?? workspace.id;
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktop(query.matches);
    updateViewport();
    query.addEventListener("change", updateViewport);
    return () => query.removeEventListener("change", updateViewport);
  }, []);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const result = await updateWorkspaceSettingsAction(
        {
          workspaceId: resolvedWorkspaceId,
          name: form.get("name"),
          description: form.get("description") || undefined,
          baseCurrency: String(
            form.get("baseCurrency") || workspace.baseCurrency || "VND",
          ),
          timeZone: String(
            form.get("timeZone") || workspace.timeZone || "Asia/Ho_Chi_Minh",
          ),
          status: String(form.get("status") || workspace.status),
        },
        resolvedWorkspaceId,
      );
      if (result.ok) {
        toast.success("Đã lưu cài đặt nhóm.");
      } else {
        toast.error(result.message ?? "Không thể lưu cài đặt.");
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
      const result = await deleteWorkspaceAction(
        confirmPassword,
        resolvedWorkspaceId,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Không thể xóa nhóm tài chính.");
        return false;
      }
      toast.success("Đã xóa nhóm tài chính.");
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
      <Card as="section" className="gap-2">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <ShieldCheck size={18} />
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Quyền truy cập thành viên
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Chỉ quản trị viên mới có thể chỉnh sửa cài đặt nhóm, quản lý
          thành viên, duyệt yêu cầu tham gia và chia sẻ mã mời.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3.5 md:space-y-5">
      {/* Main configuration */}
      <Card as="section" className="flex flex-col gap-3.5 p-4 md:gap-5 md:p-5">
        <div className="flex items-center gap-2.5 md:items-start md:gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--primary)] md:size-9"
            aria-hidden="true"
          >
            <Building2 size={17} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)] md:text-base">
              Thông tin nhóm tài chính
            </h2>
            <p className="hidden text-xs leading-relaxed text-[var(--text-secondary)] md:block">
              Cập nhật tên, mô tả và trạng thái hoạt động của nhóm tài chính.
            </p>
          </div>
        </div>

        <form
          key={`${workspace.name}:${workspace.status}:${workspace.description ?? ""}`}
          onSubmit={save}
          className="space-y-3.5 md:space-y-5"
          aria-busy={pending}
        >
          <div className="grid gap-3.5 md:grid-cols-2 md:gap-5">
            {/* Workspace name */}
            <div
              className={
                workspace.status === "deactive"
                  ? "space-y-1.5"
                  : "space-y-1.5 md:col-span-2"
              }
            >
              <Input
                label="Tên nhóm tài chính"
                id="ws-name"
                required
                name="name"
                defaultValue={workspace.name}
                className="w-full"
              />
            </div>

            {/* Status (only shown when workspace is deactivated so it can be reactivated) */}
            {workspace.status === "deactive" && (
              <div className="space-y-1.5">
                <Select
                  label="Trạng thái hoạt động"
                  id="ws-status"
                  name="status"
                  defaultValue={workspace.status}
                  options={[
                    {
                      value: "active",
                      label: "Đang hoạt động",
                      content: (
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
                          <span>Đang hoạt động</span>
                        </span>
                      ),
                    },
                    {
                      value: "deactive",
                      label: "Tạm ngưng",
                      content: (
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--warning)]" />
                          <span>Tạm ngưng</span>
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5 md:col-span-2">
              <Textarea
                label="Mô tả nhóm"
                id="ws-desc"
                name="description"
                rows={2}
                maxLength={500}
                defaultValue={workspace.description ?? ""}
                placeholder="Mục đích hoặc phạm vi quản lý thu chi của nhóm"
                className="w-full resize-none text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-[var(--border)] pt-3.5 md:pt-4">
            <Button
              type="submit"
              disabled={pending}
              variant="default"
              className="w-full md:w-auto"
            >
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
      <Card as="section" className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 md:gap-4">
          <div className="flex min-w-0 items-center gap-3 md:items-start md:gap-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--danger)] md:size-10">
              <AlertTriangle size={18} strokeWidth={1.9} />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Xóa nhóm tài chính
              </h3>
              <p className="max-w-lg text-xs leading-snug text-[var(--text-secondary)]">
                Xóa nhóm{" "}
                <strong className="break-words font-semibold text-[var(--foreground)]">
                  {workspace.name}
                </strong>
                <span className="hidden md:inline">
                  {" "}và gỡ quyền truy cập của tất cả thành viên
                </span>
                .
              </p>
            </div>
          </div>

          <div className="hidden md:block shrink-0">
            <ConfirmDelete
              ariaLabel={`Xóa nhóm tài chính ${workspace.name}`}
              title="Xóa nhóm tài chính?"
              description={
                <>
                  Nhóm <strong className="break-words leading-snug">{workspace.name}</strong> sẽ bị xóa khỏi danh sách của tất cả thành viên.
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
                  variant="destructiveIcon"
                  size="icon"
                  title={`Xóa nhóm tài chính ${workspace.name}`}
                  aria-label={`Xóa nhóm tài chính ${workspace.name}`}
                >
                  <Trash2 size={16} />
                </Button>
              }
            />
          </div>

          <div className="shrink-0 md:hidden">
            <Button
              type="button"
              disabled={pending || deleting}
              onClick={() => {
                setConfirmPassword("");
                setDeleteDialog(true);
              }}
              variant="destructiveIcon"
              size="icon"
              title={`Xóa nhóm tài chính ${workspace.name}`}
              aria-label={`Xóa nhóm tài chính ${workspace.name}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {!isDesktop && (
        <Sheet open={deleteDialog} onOpenChange={handleDeleteSheetOpenChange}>
          <SheetContent
            side="bottom"
            className="gap-0 overflow-hidden p-0"
            aria-label={`Xác nhận xóa nhóm tài chính ${workspace.name}`}
          >
            <SheetHeader className="border-b border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="text-[var(--danger)]" aria-hidden="true">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <SheetTitle>Xóa nhóm tài chính?</SheetTitle>
                  <SheetDescription>
                    Hành động này không thể hoàn tác.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-4 overflow-y-auto p-4">
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Nhóm <strong className="text-[var(--foreground)]">{workspace.name}</strong> sẽ bị xóa khỏi danh sách của tất cả thành viên. Vui lòng nhập mật khẩu để xác nhận.
              </p>

              <div className="space-y-1.5">
                <Input
                  label="Mật khẩu tài khoản"
                  id="confirm-password-input"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  className="w-full"
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

            <SheetFooter className="grid grid-cols-2 gap-2 border-t border-[var(--border)] p-4">
              <Button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteSheetOpenChange(false)}
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={deleting || !confirmPassword.trim()}
                onClick={() => void remove()}
                variant="destructive"
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
