"use client";

import { Settings2, Trash2 } from "lucide-react";
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
  const [pending, start] = useTransition();

  function save(form: FormData) {
    start(async () => {
      const result = await updateWorkspaceSettingsAction({
        name: form.get("name"),
        description: form.get("description") || undefined,
        baseCurrency: "VND",
        timeZone: "Asia/Ho_Chi_Minh",
        approvalRequired: form.get("approvalRequired") === "on",
        status: form.get("status"),
      });
      if (result.ok) {
        showToast("Đã lưu cấu hình workspace.", "success");
      } else {
        showToast(result.message ?? "Không thể lưu cấu hình.", "error");
      }
    });
  }

  function remove() {
    start(async () => {
      const result = await deleteWorkspaceAction();
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
      <section className="sunrise-card settings-readonly-card">
        <p className="settings-eyebrow">Cấu hình workspace</p>
        <h2>Bạn đang xem với quyền thành viên</h2>
        <p>Chỉ Admin có thể thay đổi cấu hình của workspace này.</p>
      </section>
    );
  }

  return (
    <>
      <section className="sunrise-card settings-config-card">
        <div className="settings-section-icon"><Settings2 size={18}/></div>
        <div className="settings-section-heading">
          <p className="settings-eyebrow">Cấu hình workspace</p>
          <h2>Thiết lập cơ bản</h2>
          <p>Thông tin nhận diện và cơ chế phê duyệt giao dịch.</p>
        </div>
        <form action={save} className="settings-config-form">
          <label>Tên workspace<input className="field" required name="name" defaultValue={workspace.name}/></label>
          <label>
            Trạng thái
            <select name="status" defaultValue={workspace.status} className="field">
              <option value="active">Đang hoạt động</option>
              <option value="deactive">Tạm ngưng</option>
            </select>
          </label>
          <label className="settings-wide-field">
            Mô tả
            <textarea className="field settings-textarea" name="description" defaultValue={workspace.description ?? ""} placeholder="Mô tả ngắn về mục đích của workspace"/>
          </label>
          <label className="settings-toggle">
            <input name="approvalRequired" type="checkbox" defaultChecked={workspace.approvalRequired}/>
            <span><strong>Yêu cầu duyệt giao dịch</strong><small>Giao dịch mới chờ Admin phê duyệt trước khi làm thay đổi số dư.</small></span>
          </label>
          <div className="settings-fixed-values">
            <span>Tiền tệ <strong>{workspace.baseCurrency}</strong></span>
            <span>Múi giờ <strong>{workspace.timeZone}</strong></span>
          </div>
          <div className="settings-form-footer">
            <div />
            <span className="flex gap-2">
              <button disabled={pending} className="button-primary">{pending ? "Đang lưu" : "Lưu thay đổi"}</button>
              <button type="button" disabled={pending} onClick={() => setDeleteDialog(true)} className="button-secondary inline-flex items-center gap-2 text-red-600"><Trash2 size={16}/>Xóa workspace</button>
            </span>
          </div>
        </form>
      </section>
      {deleteDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="delete-workspace-title">
          <section className="sunrise-card w-full max-w-md p-6">
            <h2 id="delete-workspace-title" className="text-xl font-semibold">Xóa workspace?</h2>
            <p className="mt-3 text-sm text-slate-500">Workspace <strong>{workspace.name}</strong> sẽ bị vô hiệu hóa và không còn xuất hiện trong danh sách hoạt động.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setDeleteDialog(false)} className="button-secondary">Hủy</button>
              <button type="button" disabled={pending} onClick={remove} className="button-primary bg-red-600">{pending ? "Đang xóa" : "Xác nhận xóa"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
