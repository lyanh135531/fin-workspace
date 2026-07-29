"use client";

import { Settings2, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteWorkspaceAction, updateWorkspaceSettingsAction } from "@/app/dashboard/settings/actions";
import { Button, Card, Input, Select } from "@/components/base";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Workspace = {
  name: string;
  description: string | null;
  baseCurrency: string;
  timeZone: string;
  status: "active" | "deactive";
};

export function WorkspaceSettings({ workspace, isAdmin }: { workspace: Workspace; isAdmin: boolean }) {
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
      <Card as="section" className="sunrise-card gap-0 p-6 space-y-2">
        <div className="flex items-center gap-2 text-slate-500">
          <ShieldCheck size={18} />
          <h2 className="text-base font-bold text-[var(--foreground)]">Quyền truy cập thành viên</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Chỉ Admin mới có thể chỉnh sửa cấu hình vận hành, quản lý thành viên,
          duyệt yêu cầu tham gia và chia sẻ mã mời.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Main Configuration Card ── */}
      <Card as="section" className="sunrise-card gap-0 p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Accent glow */}
        <div
          className="absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl pointer-events-none opacity-15"
          style={{ backgroundColor: "var(--primary)" }}
        />

        <div className="flex items-center gap-3 relative">
          <div className="settings-section-icon">
            <Settings2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Thiết lập cơ bản</h2>
            <p className="text-xs text-slate-500">Thông tin nhận diện và cơ chế vận hành giao dịch của workspace.</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-5 pt-2 relative">
          {/* Name — full width, prominent */}
          <div className="space-y-2">
            <Label htmlFor="ws-name" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Tên workspace <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="ws-name"
              required
              name="name"
              defaultValue={workspace.name}
              className="w-full text-base font-semibold"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="ws-status" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Trạng thái
            </Label>
            <Select
              id="ws-status"
              name="status"
              defaultValue={workspace.status}
              label="Trạng thái"
              options={[
                { value: "active", label: "🟢 Đang hoạt động" },
                { value: "deactive", label: "🟡 Tạm ngưng" },
              ]}
            />
          </div>

          {/* Description with character hint */}
          <div className="space-y-2">
            <Label htmlFor="ws-desc" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Mô tả
            </Label>
            <Textarea
              id="ws-desc"
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={workspace.description ?? ""}
              placeholder="Mục đích hoặc phạm vi sử dụng của workspace..."
              className="settings-textarea w-full text-sm resize-none"
            />
          </div>


          <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]">
            <Button
              type="submit"
              disabled={pending}
              variant="default"
            >
              {pending ? (
                <>
                  <span className="btn-spinner" aria-hidden />
                  Đang lưu...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Danger Zone Card ── */}
      <Card as="section" className="ws-danger-zone gap-0 py-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="ws-danger-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-[var(--foreground)]">Khu vực nguy hiểm</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                Vô hiệu hóa workspace <strong>{workspace.name}</strong>. Workspace bị xóa sẽ bị vô hiệu hóa và gỡ khỏi danh sách hoạt động của tất cả thành viên.
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
            variant="destructive" className="shrink-0"
          >
            <Trash2 size={15} />
            Xóa Workspace
          </Button>
        </div>
      </Card>

      {/* ── Confirmation Modal ── */}
      {deleteDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-workspace-title">
          <Card as="section" className="sunrise-card gap-0 w-full max-w-md p-6 space-y-4 relative overflow-hidden">
            {/* Red accent glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20 bg-red-500" />

            <div className="flex items-center gap-3 text-rose-600 relative">
              <div className="ws-danger-icon">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 id="delete-workspace-title" className="text-lg font-bold text-[var(--foreground)]">Xóa Workspace?</h2>
                <p className="text-xs text-slate-500">Hành động này cần được xác nhận bằng mật khẩu.</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-500 relative">
              Workspace <strong>{workspace.name}</strong> sẽ bị vô hiệu hóa. Để tiếp tục, vui lòng xác nhận bằng mật khẩu tài khoản của bạn.
            </p>

            <div className="space-y-1.5 relative">
              <Label htmlFor="confirm-password-input" className="block text-xs font-bold text-[var(--foreground)]">
                Mật khẩu tài khoản <span className="text-rose-500">*</span>
              </Label>
              <Input
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
                variant="outline" size="default"
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={pending || !confirmPassword.trim()}
                onClick={remove}
                variant="destructive" size="default"
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
