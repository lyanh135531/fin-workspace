"use client";

import { CirclePlus, Pencil, WalletCards, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createManagedWalletAction, updateManagedWalletAction } from "@/app/dashboard/wallets/actions";
import { showToast } from "@/components/toast-container";
import { formatAmount } from "@/lib/format";

type WalletItem = {
  id: string;
  name: string;
  description: string | null;
  openingBalance: string;
  currentBalance: string;
  status: "active" | "deactive";
  transactionCount: number;
  updatedAt: string;
};

export function WalletManagement({
  workspace,
  wallets,
  totalBalance,
  isAdmin,
}: {
  workspace: { name: string; currency: string };
  wallets: WalletItem[];
  totalBalance: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activeCount = wallets.filter((wallet) => wallet.status === "active").length;
  const transactionCount = wallets.reduce((total, wallet) => total + wallet.transactionCount, 0);

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createManagedWalletAction({ name: data.get("name"), openingBalance: data.get("openingBalance"), description: data.get("description") || undefined });
      if (result.ok) {
        showToast("Đã tạo ví mới.", "success");
        form.reset();
        setCreating(false);
        router.refresh();
      } else {
        showToast(result.message ?? "Không thể tạo ví.", "error");
      }
    });
  }

  function update(event: React.FormEvent<HTMLFormElement>, walletId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateManagedWalletAction({ walletId, name: data.get("name"), description: data.get("description") });
      if (result.ok) {
        showToast("Đã cập nhật thông tin ví.", "success");
        setEditing(null);
        router.refresh();
      } else {
        showToast(result.message ?? "Không thể cập nhật ví.", "error");
      }
    });
  }

  return <div className="wallet-manager">
    <header className="wallet-manager-hero">
      <div><p className="settings-eyebrow">Workspace · {workspace.name}</p><h1>Quản lý ví</h1><p>Theo dõi số dư và thông tin từng ví trong workspace hiện hành.</p></div>
      {isAdmin && <button type="button" className="button-primary wallet-manager-create" onClick={() => { setCreating((value) => !value); setEditing(null); }}><CirclePlus size={17}/>{creating ? "Đóng biểu mẫu" : "Thêm ví"}</button>}
    </header>

    <section className="wallet-manager-summary" aria-label="Tổng quan ví">
      <div><span>Tổng số dư đang hoạt động</span><strong>{formatAmount(totalBalance)} {workspace.currency}</strong></div>
      <div><span>Ví đang hoạt động</span><strong>{activeCount} / {wallets.length}</strong></div>
      <div><span>Lượt giao dịch liên quan</span><strong>{transactionCount}</strong></div>
    </section>

    {creating && <form className="wallet-manager-form" onSubmit={create}>
      <div><p className="settings-eyebrow">Ví mới</p><h2>Thêm ví vào workspace</h2></div>
      <label>Tên ví<input className="field" name="name" required maxLength={120} autoFocus placeholder="Ví dụ: Tài khoản thanh toán"/></label>
      <label>Số dư đầu kỳ<input className="field" name="openingBalance" required inputMode="decimal" placeholder="0"/></label>
      <label className="wallet-manager-wide">Mô tả<input className="field" name="description" maxLength={2000} placeholder="Mục đích sử dụng của ví"/></label>
      <div className="wallet-manager-form-actions"><button type="button" className="button-secondary" onClick={() => setCreating(false)}>Hủy</button><button className="button-primary" disabled={pending}>{pending ? "Đang tạo" : "Tạo ví"}</button></div>
    </form>}

    <section className="wallet-manager-list" aria-label="Danh sách ví">
      {wallets.map((wallet) => <article className="wallet-manager-card" key={wallet.id}>
        <header><span className="wallet-manager-icon"><WalletCards size={19}/></span><div><h2>{wallet.name}</h2><p>{wallet.status === "active" ? "Đang hoạt động" : "Tạm ngưng"}</p></div>{isAdmin && <button type="button" className="button-secondary icon-button" aria-label={`Chỉnh sửa ${wallet.name}`} title="Chỉnh sửa ví" onClick={() => { setEditing(editing === wallet.id ? null : wallet.id); setCreating(false); }}><Pencil size={16}/></button>}</header>
        <div className="wallet-manager-balance"><span>Số dư hiện tại</span><strong>{formatAmount(wallet.currentBalance)} {workspace.currency}</strong><small>Số dư đầu kỳ {formatAmount(wallet.openingBalance)} {workspace.currency}</small></div>
        <p className="wallet-manager-description">{wallet.description || "Chưa có mô tả cho ví này."}</p>
        <footer><span>{wallet.transactionCount} giao dịch</span><time dateTime={wallet.updatedAt}>Cập nhật {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(wallet.updatedAt))}</time></footer>
        {editing === wallet.id && <form className="wallet-manager-edit" onSubmit={(event) => update(event, wallet.id)}>
          <label>Tên ví<input className="field" name="name" required maxLength={120} defaultValue={wallet.name}/></label>
          <label>Mô tả<input className="field" name="description" maxLength={2000} defaultValue={wallet.description ?? ""}/></label>
          <div><button type="button" className="button-secondary icon-button" aria-label="Đóng chỉnh sửa" onClick={() => setEditing(null)}><X size={16}/></button><button className="button-primary" disabled={pending}>{pending ? "Đang lưu" : "Lưu thay đổi"}</button></div>
        </form>}
      </article>)}
      {!wallets.length && <div className="wallet-manager-empty"><WalletCards size={28}/><h2>Workspace chưa có ví</h2><p>{isAdmin ? "Tạo ví đầu tiên để bắt đầu ghi nhận giao dịch." : "Admin chưa tạo ví cho workspace này."}</p></div>}
    </section>
  </div>;
}
