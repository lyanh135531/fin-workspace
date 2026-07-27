"use client";

import { Bell, FilePenLine, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveTransactionAction, rejectTransactionAction, reviewTransactionChangeAction } from "@/app/dashboard/actions";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";
import { toast } from "sonner";

export type NotificationItem =
  | { kind: "transaction"; id: string; username: string; description: string | null; category: string | null; wallet: string; type: "income" | "expense" | "transfer"; amount: string; status: "pending" | "scheduled" }
  | { kind: "change"; id: string; username: string; description: string | null; wallet: string; type: "income" | "expense" | "transfer"; amount: string; action: "update" | "delete"; reason: string }
  | { kind: "join"; id: string; username: string };

type Role = { code: string; name: string };

const transactionTypeLabel = { income: "Thu", expense: "Chi", transfer: "Chuyển khoản" };
const money = (value: string, currency: string) => `${formatAmount(value)} ${currency === "VND" ? "₫" : currency}`;

export function NotificationsMenu({ workspaceId, items, roles, currency }: { workspaceId: string; items: NotificationItem[]; roles: Role[]; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaultRoleCode = roles.find((role) => role.code === "MEMBER")?.code ?? roles[0]?.code ?? "MEMBER";
  const [joinRoles, setJoinRoles] = useState<Record<string, string>>({});
  function reviewTransaction(id: string, approve: boolean) {
    start(async () => {
      const result = approve ? await approveTransactionAction(workspaceId, id) : await rejectTransactionAction(workspaceId, id);
      if (result.ok) {
        toast.success("Đã xử lý giao dịch.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý giao dịch.");
      }
    });
  }
  function reviewChange(id: string, approve: boolean, action: "update" | "delete") {
    start(async () => {
      const result = await reviewTransactionChangeAction(workspaceId, id, approve);
      if (result.ok) {
        toast.success(action === "delete"
          ? approve ? "Đã duyệt xóa giao dịch và cập nhật lại số dư ví." : "Đã từ chối yêu cầu xóa giao dịch."
          : approve ? "Đã duyệt thay đổi giao dịch." : "Đã từ chối thay đổi giao dịch.");
        router.refresh();
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
      <div className="notification-list" role="list" aria-label="Danh sách thông báo cần xử lý">
        {items.map((item) => item.kind === "join" ? <article role="listitem" key={`join-${item.id}`} className="notification-join-request">
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
        </article> : item.kind === "transaction" ? <article role="listitem" key={`transaction-${item.id}`}>
          <p className="font-medium">{item.description || item.category || "Giao dịch chưa ghi chú"}</p>
          <p>{item.username} · {item.wallet} · {transactionTypeLabel[item.type]} · {money(item.amount, currency)}</p>
          <div>{item.status === "pending" && <Button size="sm" variant="outline" disabled={pending} onClick={() => reviewTransaction(item.id, false)}>Từ chối</Button>}<Button size="sm" variant="default" disabled={pending} onClick={() => reviewTransaction(item.id, true)}>{item.status === "scheduled" ? "Ghi nhận sớm" : "Duyệt"}</Button></div>
        </article> : <article role="listitem" key={`change-${item.id}`} className={item.action === "delete" ? "notification-delete-request" : "notification-change-request"}>
          <p className="notification-request-title">{item.action === "delete" ? <Trash2 size={15}/> : <FilePenLine size={15}/>}<strong>{item.action === "delete" ? "Yêu cầu xóa giao dịch" : "Yêu cầu sửa giao dịch"}</strong></p>
          <p className="notification-request-description">{item.description || "Giao dịch chưa ghi chú"}</p>
          <p>{item.username} · {item.wallet} · {transactionTypeLabel[item.type]} · {money(item.amount, currency)}</p>
          <p className="notification-request-reason">Lý do: {item.reason}</p>
          <div><Button size="sm" variant="outline" disabled={pending} onClick={() => reviewChange(item.id, false, item.action)}>{item.action === "delete" ? "Từ chối xóa" : "Từ chối"}</Button><Button size="sm" variant={item.action === "delete" ? "destructive" : "default"} disabled={pending} onClick={() => reviewChange(item.id, true, item.action)}>{item.action === "delete" ? "Duyệt xóa" : "Duyệt sửa"}</Button></div>
        </article>)}
        {items.length === 0 && <p className="notification-empty">Không có yêu cầu nào cần xử lý.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
