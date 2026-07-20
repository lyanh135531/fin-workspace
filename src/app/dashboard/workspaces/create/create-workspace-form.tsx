"use client";
import { Building2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { createWorkspaceAction } from "@/app/dashboard/settings/actions";

export function CreateWorkspaceForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(form: FormData) {
    start(async () => {
      const result = await createWorkspaceAction({ name: form.get("name"), description: form.get("description") || undefined, baseCurrency: "VND", timeZone: "Asia/Ho_Chi_Minh", approvalRequired: form.get("approvalRequired") === "on" });
      setMessage(result.ok ? "Đã tạo workspace. Bạn là Admin của workspace mới và có thể chuyển sang đó từ menu Workspace." : result.message);
      if (result.ok) (document.getElementById("create-workspace-form") as HTMLFormElement | null)?.reset();
    });
  }
  return <section className="sunrise-card p-6 sm:p-8"><div className="flex items-start gap-3"><span className="settings-section-icon"><Building2 size={18}/></span><div><p className="settings-eyebrow">Workspace mới</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Tạo không gian làm việc</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Workspace là ranh giới dữ liệu độc lập cho thành viên, ví, giao dịch và danh mục. Bạn sẽ là Admin sau khi tạo.</p></div></div><form id="create-workspace-form" action={submit} className="mt-7 grid gap-5 md:grid-cols-2"><label className="text-sm font-medium">Tên workspace<input className="field mt-2" required name="name" minLength={3} maxLength={120} placeholder="Ví dụ: Chi tiêu gia đình"/></label><div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm"><p className="font-medium">Thiết lập mặc định</p><p className="mt-1 text-slate-500">Tiền tệ: VND · Múi giờ: Asia/Ho_Chi_Minh</p></div><label className="text-sm font-medium md:col-span-2">Mô tả<textarea className="field settings-textarea mt-2" name="description" maxLength={500} placeholder="Mục đích hoặc phạm vi sử dụng của workspace"/></label><label className="settings-toggle md:col-span-2"><input name="approvalRequired" type="checkbox" defaultChecked/><span><strong>Yêu cầu duyệt giao dịch</strong><small>Giao dịch mới sẽ ở trạng thái chờ cho đến khi Admin phê duyệt. Bạn có thể thay đổi trong cài đặt workspace sau này.</small></span></label><div className="flex items-center justify-between gap-3 md:col-span-2"><p className="text-sm text-slate-500" role="status">{message}</p><button disabled={pending} className="button-primary inline-flex items-center gap-2"><Plus size={17}/>{pending ? "Đang tạo" : "Tạo workspace"}</button></div></form></section>;
}
