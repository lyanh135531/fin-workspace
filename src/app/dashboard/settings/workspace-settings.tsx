"use client";

import { Settings2, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteWorkspaceAction, updateWorkspaceSettingsAction } from "@/app/dashboard/settings/actions";
import { showToast } from "@/components/toast-container";

type Workspace = {
  name: string;
  description: string | null;
  baseCurrency: string;
  timeZone: string;
  approvalRequired: boolean;
  status: "active" | "deactive";
};

export function WorkspaceSettings({ workspace, isAdmin }: { workspace: Workspace; isAdmin: boolean }) {
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, start] = useTransition();
  const [approvalOn, setApprovalOn] = useState(workspace.approvalRequired);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const result = await updateWorkspaceSettingsAction({
        name: form.get("name"),
        description: form.get("description") || undefined,
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
        approvalRequired: approvalOn,
        status: form.get("status"),
      });
      if (result.ok) {
        showToast("Đã lưu cấu hình workspace thành công!", "success");
      } else {
        showToast(result.message ?? "Không thể lưu cấu hình.", "error");
      }
    });
  }

  function remove() {
    if (!confirmPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu tài khoản để xác nhận xóa.", "error");
      return;
    }
    start(async () => {
      const result = await deleteWorkspaceAction(confirmPassword);
      if (result.ok) {
        showToast("Đã xóa workspace. Đang chuyển về tổng quan...", "success");
        window.location.assign("/overview");
      } else {
        showToast(result.message ?? "Không thể xóa workspace.", "error");
      }
    });
  }

  if (!isAdmin) {
    return (
      <section className="sunrise-card p-6 space-y-2">
        <div className="flex items-center gap-2 text-slate-500">
          <ShieldCheck size={18} />
          <h2 className="text-base font-bold text-[var(--foreground)]">Quyền truy cập thành viên</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Bạn đang xem cài đặt với quyền Member. Chỉ Admin (Owner) mới có thể chỉnh sửa cấu hình vận hành của workspace này.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Main Configuration Card ── */}
      <section className="sunrise-card p-6 sm:p-8 space-y-6 relative overflow-hidden">
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
            <label htmlFor="ws-name" className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
              Tên workspace <span className="text-rose-500">*</span>
            </label>
            <input
              id="ws-name"
              required
              name="name"
              defaultValue={workspace.name}
              className="field w-full text-base font-semibold"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label htmlFor="ws-status" className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
              Trạng thái hoạt động
            </label>
            <select id="ws-status" name="status" defaultValue={workspace.status} className="field w-full text-sm">
              <option value="active">🟢 Đang hoạt động</option>
              <option value="deactive">🟡 Tạm ngưng</option>
            </select>
          </div>

          {/* Description with character hint */}
          <div className="space-y-2">
            <label htmlFor="ws-desc" className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
              Mô tả workspace <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
            </label>
            <textarea
              id="ws-desc"
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={workspace.description ?? ""}
              placeholder="Mục đích hoặc phạm vi sử dụng của workspace..."
              className="field settings-textarea w-full text-sm resize-none"
            />
          </div>

          {/* Approval Workflow — Custom Toggle Switch */}
          <div
            className={`ws-toggle-card ${approvalOn ? "ws-toggle-card-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setApprovalOn(!approvalOn)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setApprovalOn(!approvalOn);
              }
            }}
          >
            <div
              className={`ws-toggle-track ${approvalOn ? "ws-toggle-track-on" : ""}`}
              role="switch"
              aria-checked={approvalOn}
              aria-label="Yêu cầu duyệt giao dịch"
            />
            <div className="space-y-0.5">
              <span className="font-bold text-[var(--foreground)] block text-sm">
                Yêu cầu duyệt giao dịch (Approval Workflow)
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Giao dịch mới tạo bởi Member sẽ ở trạng thái Chờ duyệt (Pending) cho đến khi Admin phê duyệt mới làm thay đổi số dư thực tế.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]">
            <button
              type="submit"
              disabled={pending}
              className="button-primary inline-flex items-center gap-2 font-semibold text-sm px-6 py-2.5 shadow-sm"
            >
              {pending ? (
                <>
                  <span className="btn-spinner" aria-hidden />
                  Đang lưu...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ── Danger Zone Card ── */}
      <section className="ws-danger-zone">
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

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setConfirmPassword("");
              setDeleteDialog(true);
            }}
            className="button-danger inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold shrink-0 shadow-sm transition-all"
          >
            <Trash2 size={15} />
            Xóa Workspace
          </button>
        </div>
      </section>

      {/* ── Confirmation Modal ── */}
      {deleteDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-workspace-title">
          <section className="sunrise-card w-full max-w-md p-6 space-y-4 relative overflow-hidden">
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
              <label htmlFor="confirm-password-input" className="block text-xs font-bold text-[var(--foreground)]">
                Mật khẩu tài khoản <span className="text-rose-500">*</span>
              </label>
              <input
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
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDeleteDialog(false);
                  setConfirmPassword("");
                }}
                className="button-secondary text-xs font-semibold px-4 py-2"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={pending || !confirmPassword.trim()}
                onClick={remove}
                className="button-danger text-xs font-semibold px-4 py-2 inline-flex items-center gap-1.5"
              >
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang xóa...
                  </>
                ) : (
                  "Xác nhận xóa"
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
