"use client";

import { Bell, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveTransactionAction, rejectTransactionAction, reviewTransactionChangeAction } from "@/app/dashboard/actions";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type NotificationItem =
  | { kind: "transaction"; id: string; username: string; description: string | null; category: string | null; wallet: string; type: "income" | "expense" | "transfer"; amount: string; status: "pending" | "scheduled" }
  | { kind: "change"; id: string; username: string; description: string | null; action: "update" | "delete"; reason: string }
  | { kind: "join"; id: string; username: string };

type Role = { code: string; name: string };

export function NotificationsMenu({ items, roles }: { items: NotificationItem[]; roles: Role[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaultRoleCode = roles.find((role) => role.code === "MEMBER")?.code ?? roles[0]?.code ?? "MEMBER";
  const [joinRoles, setJoinRoles] = useState<Record<string, string>>({});
  function reviewTransaction(id: string, approve: boolean) {
    start(async () => {
      const result = approve ? await approveTransactionAction(id) : await rejectTransactionAction(id);
      if (result.ok) {
        toast.success("Đã xử lý giao dịch.");
      } else {
        toast.error(result.message ?? "Không thể xử lý giao dịch.");
      }
    });
  }
  function reviewChange(id: string, approve: boolean) {
    start(async () => {
      const result = await reviewTransactionChangeAction(id, approve);
      if (result.ok) {
        toast.success("Đã xử lý yêu cầu thay đổi.");
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu thay đổi.");
      }
    });
  }
  function reviewJoin(id: string, approve: boolean) {
    start(async () => {
      const result = await reviewJoinAction({
        requestId: id,
        approve,
        roleCode: approve ? joinRoles[id] ?? defaultRoleCode : undefined,
      });
      if (result.ok) {
        toast.success(approve ? "Đã duyệt thành viên vào workspace." : "Đã từ chối yêu cầu tham gia.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu tham gia.");
      }
    });
  }
  return <Popover>
    <PopoverTrigger render={<button type="button" className="icon-button header-action-btn relative" aria-label="Thông báo cần xử lý"/>}>
      <Bell size={17} strokeWidth={2} />{items.length > 0 && <span className="notification-badge">{items.length}</span>}
    </PopoverTrigger>
    <PopoverContent align="end" className="notification-menu notification-popover">
      <header><strong>Cần xử lý</strong><span>{items.length} yêu cầu</span></header>
      {items.map((item) => item.kind === "join" ? <article key={`join-${item.id}`} className="notification-join-request">
        <p className="font-medium flex items-center gap-2"><UserPlus size={15} /> Yêu cầu tham gia workspace</p>
        <p><strong>{item.username}</strong> đang chờ được cấp quyền thành viên.</p>
        <label className="notification-role-field">
          <span>Vai trò</span>
          <select
            className="field"
            value={joinRoles[item.id] ?? defaultRoleCode}
            disabled={pending}
            onChange={(event) => setJoinRoles((current) => ({ ...current, [item.id]: event.target.value }))}
            aria-label={`Vai trò cấp cho ${item.username}`}
          >
            {roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
          </select>
        </label>
        <div><Button size="sm" variant="outline" disabled={pending} onClick={() => reviewJoin(item.id, false)}>Từ chối</Button><Button size="sm" variant="default" disabled={pending} onClick={() => reviewJoin(item.id, true)}>Duyệt thành viên</Button></div>
      </article> : item.kind === "transaction" ? <article key={`transaction-${item.id}`}>
        <p className="font-medium">{item.description || item.category || "Giao dịch chưa ghi chú"}</p>
        <p>{item.username} · {item.wallet} · {item.type === "income" ? "Thu" : item.type === "expense" ? "Chi" : "Chuyển khoản"} · {item.amount} ₫</p>
        <div>{item.status === "pending" && <Button size="sm" variant="outline" disabled={pending} onClick={() => reviewTransaction(item.id, false)}>Từ chối</Button>}<Button size="sm" variant="default" disabled={pending} onClick={() => reviewTransaction(item.id, true)}>{item.status === "scheduled" ? "Ghi nhận sớm" : "Duyệt"}</Button></div>
      </article> : <article key={`change-${item.id}`}>
        <p className="font-medium">{item.action === "delete" ? "Yêu cầu xóa" : "Yêu cầu sửa"}: {item.description || "Giao dịch chưa ghi chú"}</p>
        <p>{item.username} · Lý do: {item.reason}</p>
        <div><Button size="sm" variant="outline" disabled={pending} onClick={() => reviewChange(item.id, false)}>Từ chối</Button><Button size="sm" variant="default" disabled={pending} onClick={() => reviewChange(item.id, true)}>Duyệt</Button></div>
      </article>)}
      {items.length === 0 && <p className="p-5 text-sm text-slate-500">Không có yêu cầu nào cần xử lý.</p>}
    </PopoverContent>
  </Popover>;
}
