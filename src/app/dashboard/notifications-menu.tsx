"use client";

import { type ReactNode, useState, useTransition } from "react";
import {
  Bell,
  CalendarClock,
  CircleCheckBig,
  FilePenLine,
  ReceiptText,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  approveTransactionAction,
  rejectTransactionAction,
  reviewTransactionChangeAction,
} from "@/app/dashboard/actions";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { Button, Empty, Select } from "@/components/base";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatAmount } from "@/lib/format";
import type { TransactionChangeDetail } from "@/lib/transaction-change-display";

export type NotificationItem =
  | {
      kind: "transaction";
      id: string;
      username: string;
      description: string | null;
      category: string | null;
      wallet: string;
      type: "income" | "expense" | "transfer";
      amount: string;
      date: string;
      status: "pending" | "scheduled" | "executed";
    }
  | {
      kind: "change";
      id: string;
      username: string;
      description: string | null;
      wallet: string;
      type: "income" | "expense" | "transfer";
      amount: string;
      action: "update" | "delete";
      reason: string;
      details: TransactionChangeDetail[];
    }
  | { kind: "join"; id: string; username: string };

type TransactionNotification = Extract<
  NotificationItem,
  { kind: "transaction" }
>;
type ChangeNotification = Extract<NotificationItem, { kind: "change" }>;
type JoinNotification = Extract<NotificationItem, { kind: "join" }>;
type Role = { code: string; name: string };

const transactionTypeLabel: Record<TransactionNotification["type"], string> = {
  income: "Thu nhập",
  expense: "Chi tiêu",
  transfer: "Chuyển khoản",
};

const transactionStatusConfig = {
  pending: {
    label: "Chờ duyệt",
    icon: ReceiptText,
    className: "text-[var(--warning)]",
  },
  scheduled: {
    label: "Đã lên lịch",
    icon: CalendarClock,
    className: "text-[var(--warning)]",
  },
  executed: {
    label: "Đã thực hiện",
    icon: CircleCheckBig,
    className: "text-[var(--success)]",
  },
} as const;

function money(value: string, currency: string): string {
  return `${formatAmount(value)} ${currency === "VND" ? "₫" : currency}`;
}

function formatScheduledDate(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function NotificationTypeIcon({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] ${className}`}
    >
      {children}
    </span>
  );
}

function JoinNotificationCard({
  item,
  roles,
  selectedRole,
  pending,
  onRoleChange,
  onReview,
}: {
  item: JoinNotification;
  roles: Role[];
  selectedRole: string;
  pending: boolean;
  onRoleChange: (roleCode: string) => void;
  onReview: (approve: boolean) => void;
}) {
  return (
    <article role="listitem" className="p-4">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className="text-[var(--primary)]">
          <UserPlus size={17} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Yêu cầu tham gia
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                <strong className="font-semibold text-[var(--foreground)]">
                  {item.username}
                </strong>{" "}
                muốn tham gia workspace.
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[var(--warning)]">
              Chờ duyệt
            </span>
          </div>

          <div className="mt-3">
            <Select
              value={selectedRole}
              disabled={pending}
              onValueChange={onRoleChange}
              placeholder={`Vai trò cấp cho ${item.username}`}
              options={roles.map((role) => ({
                value: role.code,
                label: role.name,
              }))}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onReview(false)}
            >
              Từ chối
            </Button>
            <Button size="sm" disabled={pending} onClick={() => onReview(true)}>
              Duyệt thành viên
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TransactionNotificationCard({
  item,
  currency,
  canReview,
  pending,
  onReview,
}: {
  item: TransactionNotification;
  currency: string;
  canReview: boolean;
  pending: boolean;
  onReview: (approve: boolean) => void;
}) {
  const config = transactionStatusConfig[item.status];
  const Icon = config.icon;

  return (
    <article role="listitem" className="p-4">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className={config.className}>
          <Icon size={17} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)]">
              {item.description || item.category || "Giao dịch chưa ghi chú"}
            </p>
            <span
              className={`shrink-0 text-xs font-semibold ${config.className}`}
            >
              {config.label}
            </span>
          </div>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {item.username} · {item.wallet}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-secondary)]">
              {transactionTypeLabel[item.type]}
            </span>
            <strong className="font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {money(item.amount, currency)}
            </strong>
          </div>

          {item.status === "scheduled" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--warning)]">
              <CalendarClock size={13} aria-hidden="true" />
              Dự kiến ngày {formatScheduledDate(item.date)}
            </p>
          )}

          {canReview && item.status !== "executed" && (
            <div className="mt-3 flex justify-end gap-2">
              {item.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onReview(false)}
                >
                  Từ chối
                </Button>
              )}
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onReview(true)}
              >
                {item.status === "scheduled" ? "Duyệt sớm" : "Duyệt"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ChangeNotificationCard({
  item,
  currency,
  pending,
  onReview,
}: {
  item: ChangeNotification;
  currency: string;
  pending: boolean;
  onReview: (approve: boolean) => void;
}) {
  const deleting = item.action === "delete";
  const Icon = deleting ? Trash2 : FilePenLine;

  return (
    <article role="listitem" className="p-4">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon
          className={
            deleting ? "text-[var(--danger)]" : "text-[var(--primary)]"
          }
        >
          <Icon size={17} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {deleting ? "Yêu cầu xóa giao dịch" : "Yêu cầu sửa giao dịch"}
            </p>
            <span className="shrink-0 text-xs font-semibold text-[var(--warning)]">
              Chờ duyệt
            </span>
          </div>

          <p className="mt-2 truncate text-sm font-medium text-[var(--foreground)]">
            {item.description || "Giao dịch chưa ghi chú"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {item.username} · {item.wallet} · {transactionTypeLabel[item.type]}
          </p>
          <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {money(item.amount, currency)}
          </p>
          {deleting ? (
            <p className="mt-3 rounded-lg bg-[var(--surface-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              <strong className="font-semibold text-[var(--foreground)]">
                Lý do:
              </strong>{" "}
              {item.reason}
            </p>
          ) : (
            <div className="mt-3 rounded-lg bg-[var(--surface-secondary)] px-3 py-2.5">
              <p className="text-xs text-[var(--text-secondary)]">
                <strong className="font-semibold text-[var(--foreground)]">
                  {item.username}
                </strong>{" "}
                đã chỉnh sửa:
              </p>
              <div className="mt-2 grid gap-2">
                {item.details.map((detail) => {
                  const unit = detail.label === "Số tiền" ? ` ${currency}` : "";
                  return (
                    <div
                      key={detail.label}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 text-xs"
                    >
                      <span className="font-semibold text-[var(--text-secondary)]">
                        {detail.label}
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <del className="text-[var(--text-muted)]">
                          {detail.previous}{unit}
                        </del>
                        <span className="text-[var(--warning)]" aria-hidden="true">
                          →
                        </span>
                        <strong className="font-semibold text-[var(--success)]">
                          {detail.proposed}{unit}
                        </strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onReview(false)}
            >
              {deleting ? "Từ chối xóa" : "Từ chối"}
            </Button>
            <Button
              size="sm"
              variant={deleting ? "destructive" : "default"}
              disabled={pending}
              onClick={() => onReview(true)}
            >
              {deleting ? "Duyệt xóa" : "Duyệt sửa"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function NotificationsMenu({
  workspaceId,
  items,
  roles,
  currency,
  canReview,
}: {
  workspaceId: string;
  items: NotificationItem[];
  roles: Role[];
  currency: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaultRoleCode =
    roles.find((role) => role.code === "MEMBER")?.code ??
    roles[0]?.code ??
    "MEMBER";
  const [joinRoles, setJoinRoles] = useState<Record<string, string>>({});

  function reviewTransaction(id: string, approve: boolean): void {
    if (!canReview) return;
    start(async () => {
      const result = approve
        ? await approveTransactionAction(workspaceId, id)
        : await rejectTransactionAction(workspaceId, id);
      if (result.ok) {
        toast.success("Đã xử lý giao dịch.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý giao dịch.");
      }
    });
  }

  function reviewChange(
    id: string,
    approve: boolean,
    action: "update" | "delete",
  ): void {
    if (!canReview) return;
    start(async () => {
      const result = await reviewTransactionChangeAction(
        workspaceId,
        id,
        approve,
      );
      if (result.ok) {
        toast.success(
          action === "delete"
            ? approve
              ? "Đã duyệt xóa giao dịch và cập nhật lại số dư ví."
              : "Đã từ chối yêu cầu xóa giao dịch."
            : approve
              ? "Đã duyệt thay đổi giao dịch."
              : "Đã từ chối thay đổi giao dịch.",
        );
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu thay đổi.");
      }
    });
  }

  function reviewJoin(id: string, approve: boolean): void {
    if (!canReview) return;
    start(async () => {
      const result = await reviewJoinAction({
        requestId: id,
        approve,
        roleCode: approve ? (joinRoles[id] ?? defaultRoleCode) : undefined,
      });
      if (result.ok) {
        toast.success(
          approve
            ? "Đã duyệt thành viên vào workspace."
            : "Đã từ chối yêu cầu tham gia.",
        );
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu tham gia.");
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="icon"
            size="auto"
            type="button"
            className="size-10 min-h-10 min-w-10"
            aria-label={
              items.length > 0
                ? `Thông báo, ${items.length} mục mới`
                : "Thông báo"
            }
          />
        }
      >
        <Bell size={17} strokeWidth={2} />
        {items.length > 0 && (
          <span className="notification-badge">{items.length}</span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        aria-busy={pending}
        className="w-[min(26rem,calc(100vw-1rem))] max-h-[min(40rem,calc(100dvh-5rem))] gap-0 overflow-hidden p-0"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3.5">
          <div>
            <PopoverTitle className="font-semibold text-[var(--foreground)]">
              Thông báo
            </PopoverTitle>
            <PopoverDescription className="mt-0.5 text-xs text-[var(--text-muted)]">
              {items.length > 0
                ? "Các cập nhật cần bạn xem xét"
                : "Bạn đã xem hết thông báo"}
            </PopoverDescription>
          </div>
          {items.length > 0 && (
            <span className="rounded-md bg-[var(--surface-secondary)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              {items.length} mục
            </span>
          )}
        </header>

        <div
          className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto overscroll-contain"
          role="list"
          aria-label="Danh sách thông báo"
        >
          {items.map((item) => {
            if (item.kind === "join") {
              return (
                <JoinNotificationCard
                  key={`join-${item.id}`}
                  item={item}
                  roles={roles}
                  selectedRole={joinRoles[item.id] ?? defaultRoleCode}
                  pending={pending}
                  onRoleChange={(roleCode) =>
                    setJoinRoles((current) => ({
                      ...current,
                      [item.id]: roleCode,
                    }))
                  }
                  onReview={(approve) => reviewJoin(item.id, approve)}
                />
              );
            }

            if (item.kind === "transaction") {
              return (
                <TransactionNotificationCard
                  key={`transaction-${item.id}`}
                  item={item}
                  currency={currency}
                  canReview={canReview}
                  pending={pending}
                  onReview={(approve) => reviewTransaction(item.id, approve)}
                />
              );
            }

            return (
              <ChangeNotificationCard
                key={`change-${item.id}`}
                item={item}
                currency={currency}
                pending={pending}
                onReview={(approve) =>
                  reviewChange(item.id, approve, item.action)
                }
              />
            );
          })}

          {items.length === 0 && (
            <Empty
              variant="compact"
              icon={Bell}
              title="Không có thông báo mới"
              description="Các yêu cầu và cập nhật mới sẽ xuất hiện tại đây."
              className="min-h-52"
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
