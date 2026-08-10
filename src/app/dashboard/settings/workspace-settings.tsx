"use client";

import { AlertTriangle, Building2, ShieldCheck, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  deleteWorkspaceAction,
  updateWorkspaceSettingsAction,
} from "@/app/dashboard/settings/actions";
import { Button, Card, Input, Select } from "@/components/base";
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
  const [pending, start] = useTransition();

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
        toast.success("Đã lưu cấu hình workspace thành công!");
      } else {
        toast.error(result.message ?? "Không thể lưu cấu hình.");
      }
    });
  }

  function remove() {
    if (!confirmPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu tài khoản để xác nhận xóa.");
      return;
    }
    start(async () => {
      const result = await deleteWorkspaceAction(confirmPassword);
      if (result.ok) {
        toast.success("Đã xóa workspace. Đang chuyển về tổng quan...");
        window.location.assign("/overview");
      } else {
        toast.error(result.message ?? "Không thể xóa workspace.");
      }
    });
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
    <div className="workspace-settings-stack space-y-6">
      {/* ── Main Configuration Card (Single-Bezel) ── */}
      <Card
        as="section"
        className="workspace-config-section shadow-xs relative overflow-hidden flex flex-col gap-6"
      >
        <div className="workspace-config-heading flex flex-col md:flex-row md:items-start gap-4 md:gap-8 justify-between relative z-10">
          <div className="flex max-w-md items-start gap-3">
            <span className="workspace-config-heading-icon" aria-hidden="true">
              <Building2 size={18} strokeWidth={1.8} />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                Thông tin chung
              </h2>
              <p className="text-xs leading-relaxed text-slate-500">
                Quản lý tên, mô tả và trạng thái hoạt động của workspace.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={save}
          className="relative z-10 space-y-6"
          aria-busy={pending}
        >
          <div className="grid gap-6">
            {/* Name — full width, prominent */}
            <div className="space-y-2">
              <Input
                label="Tên workspace"
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
            <div className="space-y-2">
              <Textarea
                label="Mô tả"
                id="ws-desc"
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={workspace.description ?? ""}
                placeholder="Mục đích hoặc phạm vi sử dụng của workspace..."
                className="settings-textarea w-full text-sm resize-none"
              />
            </div>
          </div>

          <div className="workspace-config-actions flex items-center justify-end border-t border-[var(--border)] pt-5">
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

      {/* ── Danger Zone Card (Single-Bezel) ── */}
      <Card
        as="section"
        className="workspace-danger-section p-5 md:p-6 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-900/5 mt-1 md:mt-0">
              <AlertTriangle size={18} strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-[var(--foreground)]">
                Khu vực nguy hiểm
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                Vô hiệu hóa workspace{" "}
                <strong className="font-semibold text-[var(--text-primary)]">
                  {workspace.name}
                </strong>
                . Mọi dữ liệu sẽ bị ẩn và workspace bị gỡ khỏi danh sách của tất
                cả thành viên.
              </p>
            </div>
          </div>

          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setConfirmPassword("");
              setDeleteDialog(true);
            }}
            variant="destructive"
          >
            <Trash2 size={16} className="mr-2" />
            Xóa Workspace
          </Button>
        </div>
      </Card>

      {/* ── Confirmation Modal ── */}
      {deleteDialog && (
        <div
          className="workspace-delete-overlay fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-workspace-title"
        >
          <Card
            as="section"
            className="workspace-delete-panel sunrise-card gap-0 w-full max-w-md p-6 space-y-4 relative overflow-hidden"
          >
            {/* Red accent glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20 bg-red-500" />

            <div className="flex items-center gap-3 text-rose-600 relative">
              <div className="ws-danger-icon">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2
                  id="delete-workspace-title"
                  className="text-lg font-bold text-[var(--foreground)]"
                >
                  Xóa Workspace?
                </h2>
                <p className="text-xs text-slate-500">
                  Hành động này cần được xác nhận bằng mật khẩu.
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-500 relative">
              Workspace <strong>{workspace.name}</strong> sẽ bị vô hiệu hóa. Để
              tiếp tục, vui lòng xác nhận bằng mật khẩu tài khoản của bạn.
            </p>

            <div className="space-y-1.5 relative">
              <Input
                label="Mật khẩu tài khoản"
                id="confirm-password-input"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn..."
                className="field w-full text-sm font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && confirmPassword.trim() && !pending) {
                    e.preventDefault();
                    remove();
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)] relative">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDeleteDialog(false);
                  setConfirmPassword("");
                }}
                variant="outline"
                size="default"
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={pending || !confirmPassword.trim()}
                onClick={remove}
                variant="destructive"
                size="default"
              >
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang xóa...
                  </>
                ) : (
                  "Xác nhận xóa"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
