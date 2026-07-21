"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";
import { approveTransactionAction, rejectTransactionAction, reviewTransactionChangeAction } from "@/app/dashboard/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type NotificationItem =
  | { kind: "transaction"; id: string; username: string; description: string | null; category: string | null; wallet: string; type: "income" | "expense" | "transfer"; amount: string; status: "pending" | "scheduled" }
  | { kind: "change"; id: string; username: string; description: string | null; action: "update" | "delete"; reason: string };

export function NotificationsMenu({ items }: { items: NotificationItem[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function reviewTransaction(id: string, approve: boolean) {
    start(async () => {
      const result = approve ? await approveTransactionAction(id) : await rejectTransactionAction(id);
      setMessage(result.ok ? "Đã xử lý giao dịch." : result.message ?? "Không thể xử lý giao dịch.");
    });
  }
  function reviewChange(id: string, approve: boolean) {
    start(async () => {
      const result = await reviewTransactionChangeAction(id, approve);
      setMessage(result.ok ? "Đã xử lý yêu cầu thay đổi." : result.message ?? "Không thể xử lý yêu cầu thay đổi.");
    });
  }
  return <Popover>
    <PopoverTrigger render={<button className="button-secondary icon-button relative" title="Giao dịch cần xử lý" aria-label="Giao dịch cần xử lý"/>}>
      <Bell size={18}/>{items.length > 0 && <span className="notification-badge">{items.length}</span>}
    </PopoverTrigger>
    <PopoverContent align="end" className="notification-menu notification-popover">
      <header><strong>Cần xử lý</strong><span>{items.length} yêu cầu</span></header>
      {items.map((item) => item.kind === "transaction" ? <article key={`transaction-${item.id}`}>
        <p className="font-medium">{item.description || item.category || "Giao dịch chưa ghi chú"}</p>
        <p>{item.username} · {item.wallet} · {item.type === "income" ? "Thu" : item.type === "expense" ? "Chi" : "Chuyển khoản"} · {item.amount} ₫</p>
        <div>{item.status === "pending" && <button disabled={pending} onClick={() => reviewTransaction(item.id, false)} className="button-secondary">Từ chối</button>}<button disabled={pending} onClick={() => reviewTransaction(item.id, true)} className="button-primary">{item.status === "scheduled" ? "Ghi nhận sớm" : "Duyệt"}</button></div>
      </article> : <article key={`change-${item.id}`}>
        <p className="font-medium">{item.action === "delete" ? "Yêu cầu xóa" : "Yêu cầu sửa"}: {item.description || "Giao dịch chưa ghi chú"}</p>
        <p>{item.username} · Lý do: {item.reason}</p>
        <div><button disabled={pending} onClick={() => reviewChange(item.id, false)} className="button-secondary">Từ chối</button><button disabled={pending} onClick={() => reviewChange(item.id, true)} className="button-primary">Duyệt</button></div>
      </article>)}
      {items.length === 0 && <p className="p-5 text-sm text-slate-500">Không có yêu cầu nào cần xử lý.</p>}
      {message && <p className="p-3 text-sm" role="status">{message}</p>}
    </PopoverContent>
  </Popover>;
}
