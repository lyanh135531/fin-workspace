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
      {/* ── Main Configuration Card (Single-Bezel) ── */}
      <Card as="section" className="rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-8 justify-between relative z-10">
          <div className="space-y-2 max-w-md">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Thiết lập cơ bản
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Thông tin chung</h2>
            <p className="text-xs leading-relaxed text-slate-500">
              Quản lý tên, mô tả và trạng thái hoạt động của workspace. Những thông tin này giúp các thành viên nhận diện nhóm dễ dàng hơn.
            </p>
          </div>
          <div className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-900/5 shrink-0">
            <Settings2 size={20} strokeWidth={1.5} />
          </div>
        </div>

        <form onSubmit={save} className="relative z-10 space-y-6">
          <div className="grid gap-6">
          {/* Name — full width, prominent */}
          <div className="space-y-2">
            <Label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
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
            <Label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Trạng thái
            </Label>
            <Select
              id="ws-status"
              name="status"
              defaultValue={workspace.status}
              label="Trạng thái"
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
            <Label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
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


          </div>

          <div className="flex items-center justify-end border-t border-slate-100 pt-5">
            <Button
              type="submit"
              disabled={pending}
              variant="default"
              className="rounded-full px-6 py-2.5 font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
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

      {/* ── Danger Zone Card (Single-Bezel) ── */}
      <Card as="section" className="rounded-2xl border border-rose-200/40 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-900/5 mt-1 md:mt-0">
              <AlertTriangle size={18} strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-slate-900">Khu vực nguy hiểm</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                Vô hiệu hóa workspace <strong className="font-semibold text-slate-700">{workspace.name}</strong>. Mọi dữ liệu sẽ bị ẩn và workspace bị gỡ khỏi danh sách của tất cả thành viên.
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
            className="shrink-0 rounded-full px-5 py-2.5 font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            <Trash2 size={16} className="mr-2" />
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
              <Label className="block text-xs font-bold text-[var(--foreground)]">
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
