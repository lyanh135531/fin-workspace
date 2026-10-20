"use client";

import {
  type ReactNode,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  Bell,
  BellRing,
  CalendarClock,
  CircleCheckBig,
  CircleDollarSign,
  CircleX,
  FilePenLine,
  MoonStar,
  Plus,
  ReceiptText,
  Repeat2,
  SlidersHorizontal,
  SunMedium,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePrivacyMask } from "@/lib/privacy-mask";
import { useOptionalPwaInstall } from "@/app/pwa-install";

import {
  approveTransactionAction,
  rejectTransactionAction,
  reviewTransactionChangeAction,
} from "@/app/dashboard/actions";
import {
  DailyReminderControls,
  detectPushSupport,
  type PushSupportState,
  requestPushPermissionFromGesture,
  subscribeBrowserToPush,
} from "@/app/dashboard/daily-reminder-controls";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { reviewRecurringTransactionAction } from "@/app/dashboard/recurring-transactions/actions";
import { reviewFinancialGoalFundingAction } from "@/app/dashboard/financial-plans/actions";
import {
  dismissDailyReminderAction,
  updateUserReminderSettingsAction,
} from "@/app/dashboard/settings/reminder-actions";
import { ApprovalActionButton } from "@/components/approval-action-icon";
import {
  Button,
  Empty,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/base";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatAmount } from "@/lib/format";
import type { TransactionChangeDetail } from "@/lib/transaction-change-display";
import type { UserReminderState } from "@/services/reminder-service";

export type NotificationItem =
  | {
      kind: "dailyReminder";
      id: string;
      slot: "noon" | "evening";
    }
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
  | { kind: "join"; id: string; username: string }
  | {
      kind: "recurring";
      id: string;
      username: string;
      description: string | null;
      type: "income" | "expense" | "transfer";
      amount: string;
      approvalStatus: "pending" | "approved" | "rejected";
    }
  | {
      kind: "goalFunding";
      id: string;
      username: string;
      goalName: string;
      amount: string;
      approvalStatus: "pending" | "approved" | "rejected";
    };

type DailyReminderNotification = Extract<
  NotificationItem,
  { kind: "dailyReminder" }
>;
type TransactionNotification = Extract<
  NotificationItem,
  { kind: "transaction" }
>;
type ChangeNotification = Extract<NotificationItem, { kind: "change" }>;
type JoinNotification = Extract<NotificationItem, { kind: "join" }>;
type RecurringNotification = Extract<NotificationItem, { kind: "recurring" }>;
type GoalFundingNotification = Extract<NotificationItem, { kind: "goalFunding" }>;
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
    <article
      role="listitem"
      className="notification-item notification-item-join p-4"
    >
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
                muốn tham gia nhóm tài chính.
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
              placeholder={`Chọn vai trò cho ${item.username}`}
              options={roles.map((role) => ({
                value: role.code,
                label: role.name,
              }))}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <ApprovalActionButton
              decision="reject"
              disabled={pending}
              onClick={() => onReview(false)}
            />
            <ApprovalActionButton
              decision="approve"
              disabled={pending}
              onClick={() => onReview(true)}
            />
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
    <article
      role="listitem"
      className="notification-item notification-item-transaction p-4"
      data-notification-status={item.status}
    >
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className={config.className}>
          <Icon size={17} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
              {item.description || item.category || "Không có ghi chú"}
            </p>
            <span
              className={`shrink-0 text-xs font-semibold ${config.className}`}
            >
              {config.label}
            </span>
          </div>

          <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
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
                <ApprovalActionButton
                  decision="reject"
                  disabled={pending}
                  onClick={() => onReview(false)}
                />
              )}
              {item.status === "pending" ? (
                <ApprovalActionButton
                  decision="approve"
                  disabled={pending}
                  onClick={() => onReview(true)}
                />
              ) : (
                <Button
                  size="icon"
                  variant="success"
                  disabled={pending}
                  aria-label="Ghi nhận sớm"
                  title="Ghi nhận sớm"
                  onClick={() => onReview(true)}
                >
                  <CircleCheckBig size={16} aria-hidden="true" />
                </Button>
              )}
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
    <article
      role="listitem"
      className="notification-item notification-item-change p-4"
      data-change-action={item.action}
    >
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

          <p className="mt-2 break-words text-sm font-medium leading-snug text-[var(--foreground)]">
            {item.description || "Không có ghi chú"}
          </p>
          <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
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
                          {detail.previous}
                          {unit}
                        </del>
                        <span
                          className="text-[var(--warning)]"
                          aria-hidden="true"
                        >
                          →
                        </span>
                        <strong className="font-semibold text-[var(--success)]">
                          {detail.proposed}
                          {unit}
                        </strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <ApprovalActionButton
              decision="reject"
              disabled={pending}
              onClick={() => onReview(false)}
            />
            <ApprovalActionButton
              decision="approve"
              disabled={pending}
              onClick={() => onReview(true)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function RecurringNotificationCard({
  item,
  currency,
  pending,
  canReview,
  onReview,
}: {
  item: RecurringNotification;
  currency: string;
  pending: boolean;
  canReview: boolean;
  onReview: (approve: boolean) => void;
}) {
  const approved = item.approvalStatus === "approved";
  const rejected = item.approvalStatus === "rejected";
  const Icon = approved ? CircleCheckBig : rejected ? CircleX : Repeat2;
  const label = approved ? "Đã duyệt" : rejected ? "Đã từ chối" : "Chờ duyệt";
  const color = approved ? "text-[var(--success)]" : rejected ? "text-[var(--danger)]" : "text-[var(--warning)]";
  return (
    <article role="listitem" className="notification-item p-4">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className={color}>
          <Icon size={17} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
              {item.description || "Giao dịch định kỳ"}
            </p>
            <span className={`shrink-0 text-xs font-semibold ${color}`}>{label}</span>
          </div>
          <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
            {item.username} · {transactionTypeLabel[item.type]}
          </p>
          <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {money(item.amount, currency)}
          </p>
          {canReview && item.approvalStatus === "pending" && (
            <div className="mt-3 flex justify-end gap-2">
              <ApprovalActionButton
                decision="reject"
                disabled={pending}
                onClick={() => onReview(false)}
              />
              <ApprovalActionButton
                decision="approve"
                disabled={pending}
                onClick={() => onReview(true)}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function GoalFundingNotificationCard({ item, currency, pending, canReview, onReview }: {
  item: GoalFundingNotification;
  currency: string;
  pending: boolean;
  canReview: boolean;
  onReview: (approve: boolean) => void;
}) {
  const approved = item.approvalStatus === "approved";
  const rejected = item.approvalStatus === "rejected";
  const label = approved ? "Đã duyệt" : rejected ? "Đã từ chối" : "Chờ duyệt";
  const color = approved ? "text-[var(--success)]" : rejected ? "text-[var(--destructive)]" : "text-[var(--warning)]";
  return (
    <article role="listitem" className="notification-item p-4">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className={color}><CircleDollarSign size={17} aria-hidden="true" /></NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">{item.goalName}</p>
            <span className={`shrink-0 text-xs font-semibold ${color}`}>{label}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{item.username} · Đóng góp mục tiêu</p>
          <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">{money(item.amount, currency)}</p>
          {canReview && item.approvalStatus === "pending" && (
            <div className="mt-3 flex justify-end gap-2">
              <ApprovalActionButton decision="reject" disabled={pending} onClick={() => onReview(false)} />
              <ApprovalActionButton decision="approve" disabled={pending} onClick={() => onReview(true)} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DailyReminderNotificationCard({
  item,
  pending,
  onLogNow,
  onDismissToday,
}: {
  item: DailyReminderNotification;
  pending: boolean;
  onLogNow: () => void;
  onDismissToday: () => void;
}) {
  const isNoon = item.slot === "noon";
  const Icon = isNoon ? SunMedium : MoonStar;

  return (
    <article role="listitem" className="notification-item px-4 py-3.5">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className="text-[var(--primary)]">
          <Icon size={17} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="break-words text-[13px] font-semibold leading-snug text-[var(--foreground)]">
              {isNoon
                ? "Nhắc ghi chi tiêu buổi trưa"
                : "Nhắc ghi chi tiêu cuối ngày"}
            </p>
            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-[var(--primary)]">
              {isNoon ? "12:30" : "21:00"}
            </span>
          </div>
          <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">
            {isNoon
              ? "Bạn chưa ghi giao dịch nào trong sáng nay. Ghi nhanh để số dư luôn chính xác."
              : "Hôm nay bạn chưa ghi giao dịch nào. Cập nhật ngay để khép sổ chi tiêu trong ngày."}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onDismissToday}
              className="h-7 px-2.5 text-[11px] text-[var(--text-muted)]"
            >
              Hôm nay không chi
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={pending}
              onClick={onLogNow}
              className="h-7 px-2.5 text-[11px]"
            >
              <Plus size={13} aria-hidden="true" />
              Ghi giao dịch
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

const REMINDER_INTRO_DISMISSED_KEY = "felix.reminder.intro-dismissed-v1";
const REMINDER_BELL_GUIDE_DISMISSED_KEY = "felix.reminder.bell-guide-dismissed-v1";

function ReminderGuideNotificationCard({
  onFocusControls,
  onDismiss,
}: {
  onFocusControls: () => void;
  onDismiss: () => void;
}) {
  return (
    <article role="listitem" className="notification-item px-4 py-3.5">
      <div className="flex items-start gap-3">
        <NotificationTypeIcon className="text-[var(--primary)]">
          <SlidersHorizontal size={16} aria-hidden="true" />
        </NotificationTypeIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="break-words text-[13px] font-semibold leading-snug text-[var(--foreground)]">
              Lịch nhắc ghi chi tiêu mặc định
            </p>
            <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
              Mẹo
            </span>
          </div>
          <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">
            Hệ thống tự nhắc lúc 12:30 và 21:00 khi trong ngày chưa có giao dịch. Chạm vào 2 khung giờ phía trên để bật hoặc tắt tùy ý.
          </p>
          <div className="mt-2.5 flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-7 px-2.5 text-[11px] text-[var(--text-muted)]"
            >
              Đã hiểu
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFocusControls}
              className="h-7 px-2.5 text-[11px]"
            >
              Tùy chỉnh
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function DailyReminderIntroSheet({
  open,
  isMobile,
  pending,
  support,
  deviceSubscribed,
  onOpenChange,
  onEnableDevice,
  onOpenBellCustomize,
  onDismiss,
}: {
  open: boolean;
  isMobile: boolean;
  pending: boolean;
  support: PushSupportState;
  deviceSubscribed: boolean;
  onOpenChange: (open: boolean) => void;
  onEnableDevice: () => void;
  onOpenBellCustomize: () => void;
  onDismiss: () => void;
}) {
  const canEnableDevice = support === "supported" && !deviceSubscribed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "center"}
        placement="inset"
        size="default"
        spacing="flush"
        elevation="flat"
        aria-label="Giới thiệu nhắc ghi chi tiêu hàng ngày"
      >
        <SheetHeader className="px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 pr-8">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <BellRing size={19} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                Tiện ích nhắc nhở
              </p>
              <SheetTitle className="mt-0.5 text-base font-semibold leading-snug tracking-tight text-balance sm:text-lg">
                Nhắc ghi chi tiêu hàng ngày
              </SheetTitle>
            </div>
          </div>
          <SheetDescription className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            Tự động nhắc nhẹ lúc 12:30 trưa và 21:00 tối nếu trong ngày bạn chưa ghi giao dịch nào.
          </SheetDescription>
        </SheetHeader>

        <div className="mx-5 mt-3.5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/55 sm:mx-6">
          <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <SunMedium
                  size={15}
                  className="shrink-0 text-[var(--primary)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold tabular-nums leading-tight text-[var(--foreground)]">
                    12:30
                  </p>
                  <p className="text-[10px] leading-tight text-[var(--text-muted)]">
                    Buổi trưa
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--primary)]">
                Bật
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <MoonStar
                  size={15}
                  className="shrink-0 text-[var(--primary)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold tabular-nums leading-tight text-[var(--foreground)]">
                    21:00
                  </p>
                  <p className="text-[10px] leading-tight text-[var(--text-muted)]">
                    Buổi tối
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--primary)]">
                Bật
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-t border-[var(--border)] bg-[var(--surface)]/75 px-3.5 py-2.5">
            <span
              className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--surface-secondary)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Bell size={13} strokeWidth={2} />
            </span>
            <p className="min-w-0 break-words text-[11px] leading-snug text-[var(--text-secondary)]">
              Tùy chỉnh khung giờ bất cứ lúc nào tại biểu tượng{" "}
              <strong className="font-semibold text-[var(--foreground)]">
                Chuông thông báo
              </strong>{" "}
              trên thanh công cụ.
            </p>
          </div>
        </div>

        <SheetFooter className="grid grid-cols-2 gap-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {canEnableDevice ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={pending}
                className="h-10 w-full rounded-xl text-xs font-semibold"
                onClick={onOpenBellCustomize}
              >
                Tùy chỉnh giờ
              </Button>
              <Button
                type="button"
                variant="landing"
                size="default"
                disabled={pending}
                className="h-10 w-full rounded-xl text-xs font-semibold"
                onClick={onEnableDevice}
              >
                <BellRing size={14} aria-hidden="true" />
                Bật thông báo
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="default"
                disabled={pending}
                className="h-10 w-full rounded-xl text-xs font-semibold"
                onClick={onDismiss}
              >
                Đã hiểu
              </Button>
              <Button
                type="button"
                variant="landing"
                size="default"
                disabled={pending}
                className="h-10 w-full rounded-xl text-xs font-semibold"
                onClick={onOpenBellCustomize}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                Tùy chỉnh giờ
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function NotificationsMenu({
  workspaceId,
  items,
  roles,
  currency,
  canReview,
  reminderState,
}: {
  workspaceId: string;
  items: NotificationItem[];
  roles: Role[];
  currency: string;
  canReview: boolean;
  reminderState?: UserReminderState | null;
}) {
  usePrivacyMask();
  const router = useRouter();
  const pwaInstall = useOptionalPwaInstall();
  const isPwaBannerOpen = Boolean(pwaInstall?.canInstall && pwaInstall?.showBanner);
  const [pending, start] = useTransition();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [highlightControls, setHighlightControls] = useState(false);
  const [showGuideCard, setShowGuideCard] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [pushSupport, setPushSupport] = useState<PushSupportState>("checking");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const defaultRoleCode =
    roles.find((role) => role.code === "MEMBER")?.code ??
    roles[0]?.code ??
    "MEMBER";
  const [joinRoles, setJoinRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;

    function handleExternalSubscribe() {
      setDeviceSubscribed(true);
      setPushSupport("supported");
    }

    window.addEventListener(
      "felix-reminder-device-subscribed",
      handleExternalSubscribe,
    );

    void Promise.resolve().then(async () => {
      const detected = detectPushSupport();
      if (!active) return;
      setPushSupport(detected);

      let hasSub = false;
      if (detected === "supported") {
        try {
          const registration = await navigator.serviceWorker.getRegistration("/");
          const sub = await registration?.pushManager.getSubscription();
          hasSub = Boolean(sub);
        } catch {
          hasSub = false;
        }
      }
      if (!active) return;
      setDeviceSubscribed(hasSub);

      let guideDismissed = false;
      let introDismissed = false;
      try {
        guideDismissed =
          window.localStorage.getItem(REMINDER_BELL_GUIDE_DISMISSED_KEY) === "1";
        introDismissed =
          window.localStorage.getItem(REMINDER_INTRO_DISMISSED_KEY) === "1";
      } catch {
        guideDismissed = false;
        introDismissed = false;
      }

      if (!guideDismissed) {
        setShowGuideCard(true);
      }

      const isAutomatedBrowser =
        typeof navigator !== "undefined" && navigator.webdriver === true;
      if (!introDismissed && !hasSub && !isAutomatedBrowser) {
        setIntroOpen(true);
      }
    });

    return () => {
      active = false;
      window.removeEventListener(
        "felix-reminder-device-subscribed",
        handleExternalSubscribe,
      );
    };
  }, []);

  function markIntroSeen(): void {
    setIntroOpen(false);
    try {
      window.localStorage.setItem(REMINDER_INTRO_DISMISSED_KEY, "1");
    } catch {
      // Storage may be restricted in private browsing.
    }
  }

  function dismissGuideCard(): void {
    setShowGuideCard(false);
    try {
      window.localStorage.setItem(REMINDER_BELL_GUIDE_DISMISSED_KEY, "1");
    } catch {
      // Storage may be restricted in private browsing.
    }
  }

  function triggerHighlightControls(): void {
    setHighlightControls(true);
    window.setTimeout(() => {
      const el = document.getElementById("daily-reminder-controls-compact");
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    window.setTimeout(() => {
      setHighlightControls(false);
    }, 3200);
  }

  function handleOpenBellFromIntro(): void {
    markIntroSeen();
    window.setTimeout(() => {
      if (isMobile) {
        setMobileOpen(true);
      } else {
        setPopoverOpen(true);
      }
      triggerHighlightControls();
    }, 120);
  }

  async function handleEnableDeviceFromIntro(): Promise<void> {
    if (!reminderState) {
      handleOpenBellFromIntro();
      return;
    }

    const permissionRes = await requestPushPermissionFromGesture();
    setPushSupport(permissionRes.support);
    if (!permissionRes.granted) return;

    start(async () => {
      const subRes = await subscribeBrowserToPush(reminderState.vapidPublicKey);
      if (!subRes.ok) return;

      const browserTimeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        reminderState.timeZone;
      await updateUserReminderSettingsAction({
        noonEnabled: true,
        eveningEnabled: true,
        timeZone: browserTimeZone,
      });

      setDeviceSubscribed(true);
      markIntroSeen();
      toast.success("Đã bật nhận thông báo. Bạn có thể đổi giờ nhắc tại mục Thông báo.");
      router.refresh();
    });
  }

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
              ? "Đã duyệt xóa giao dịch."
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
            ? "Đã duyệt thành viên vào nhóm."
            : "Đã từ chối yêu cầu tham gia.",
        );
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu tham gia.");
      }
    });
  }

  function reviewRecurring(id: string, approve: boolean): void {
    if (!canReview) return;
    start(async () => {
      const result = await reviewRecurringTransactionAction(id, approve);
      if (result.ok) {
        toast.success(approve ? "Đã duyệt và kích hoạt lịch." : "Đã từ chối lịch.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý lịch định kỳ.");
      }
    });
  }

  function reviewGoalFunding(id: string, approve: boolean): void {
    if (!canReview) return;
    start(async () => {
      const result = await reviewFinancialGoalFundingAction({ entryId: id, approve });
      if (result.ok) {
        toast.success(approve ? "Đã duyệt khoản đóng góp." : "Đã từ chối khoản đóng góp.");
        router.refresh();
      } else toast.error(result.message ?? "Không thể xử lý khoản đóng góp.");
    });
  }

  function openQuickTransactionFromReminder(): void {
    setMobileOpen(false);
    setPopoverOpen(false);
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("open-quick-transaction", {
          detail: { type: "expense" },
        }),
      );
    }, 60);
  }

  function dismissReminderToday(): void {
    start(async () => {
      const result = await dismissDailyReminderAction();
      if (result.ok) {
        toast.success("Đã ghi nhận hôm nay chưa phát sinh chi tiêu.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể cập nhật nhắc nhở.");
      }
    });
  }

  const totalBadgeCount = items.length + (showGuideCard ? 1 : 0);

  const guideNotificationNode = showGuideCard ? (
    <ReminderGuideNotificationCard
      key="reminder-guide-default"
      onFocusControls={triggerHighlightControls}
      onDismiss={dismissGuideCard}
    />
  ) : null;

  const notificationItems = items.map((item) => {
    if (item.kind === "dailyReminder") {
      return (
        <DailyReminderNotificationCard
          key={item.id}
          item={item}
          pending={pending}
          onLogNow={openQuickTransactionFromReminder}
          onDismissToday={dismissReminderToday}
        />
      );
    }

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

    if (item.kind === "recurring") {
      return (
        <RecurringNotificationCard
          key={`recurring-${item.id}`}
          item={item}
          currency={currency}
          pending={pending}
          canReview={canReview}
          onReview={(approve) => reviewRecurring(item.id, approve)}
        />
      );
    }

    if (item.kind === "goalFunding") {
      return (
        <GoalFundingNotificationCard
          key={`goal-funding-${item.id}`}
          item={item}
          currency={currency}
          pending={pending}
          canReview={canReview}
          onReview={(approve) => reviewGoalFunding(item.id, approve)}
        />
      );
    }

    return (
      <ChangeNotificationCard
        key={`change-${item.id}`}
        item={item}
        currency={currency}
        pending={pending}
        onReview={(approve) => reviewChange(item.id, approve, item.action)}
      />
    );
  });

  const emptyNotification = totalBadgeCount === 0 && (
    <Empty
      variant="compact"
      icon={Bell}
      title="Không có thông báo mới"
      description="Các yêu cầu và cập nhật mới sẽ xuất hiện tại đây."
      className="notification-empty-state min-h-44"
    />
  );

  const introSheetNode = (
    <DailyReminderIntroSheet
      open={introOpen && !isPwaBannerOpen}
      isMobile={isMobile}
      pending={pending}
      support={pushSupport}
      deviceSubscribed={deviceSubscribed}
      onOpenChange={(open) => {
        if (!open) markIntroSeen();
      }}
      onEnableDevice={() => void handleEnableDeviceFromIntro()}
      onOpenBellCustomize={handleOpenBellFromIntro}
      onDismiss={markIntroSeen}
    />
  );

  if (isMobile) {
    return (
      <>
        {introSheetNode}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="icon"
                size="icon"
                type="button"
                className="relative"
                aria-label={
                  totalBadgeCount > 0
                    ? `Thông báo, ${totalBadgeCount} mục mới`
                    : "Thông báo"
                }
              />
            }
          >
            <Bell size={17} strokeWidth={2} />
            {totalBadgeCount > 0 && (
              <span className="notification-badge">{totalBadgeCount}</span>
            )}
          </SheetTrigger>

          <SheetContent
            side="bottom"
            aria-busy={pending}
            aria-label="Thông báo"
          >
            <SheetHeader
              icon={Bell}
              title="Thông báo"
              description={
                totalBadgeCount > 0
                  ? `${totalBadgeCount} cập nhật mới trong nhóm`
                  : "Bạn đã xem hết thông báo"
              }
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="border-b border-[var(--border)] px-3.5 py-3">
                <DailyReminderControls
                  initialState={reminderState}
                  variant="compact"
                  highlighted={highlightControls}
                />
              </div>

              <div
                className="divide-y divide-[var(--border)]"
                role="list"
                aria-label="Danh sách thông báo"
              >
                {guideNotificationNode}
                {notificationItems}
                {emptyNotification}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {introSheetNode}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="icon"
              size="icon"
              type="button"
              className="relative"
              aria-label={
                totalBadgeCount > 0
                  ? `Thông báo, ${totalBadgeCount} mục mới`
                  : "Thông báo"
              }
            />
          }
        >
          <Bell size={17} strokeWidth={2} />
          {totalBadgeCount > 0 && (
            <span className="notification-badge">{totalBadgeCount}</span>
          )}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={10}
          aria-busy={pending}
          className="w-[min(26rem,calc(100vw-1rem))] max-h-[min(42rem,calc(100dvh-5rem))] gap-0 overflow-hidden p-0"
        >
          <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3.5">
            <div>
              <PopoverTitle className="font-semibold text-[var(--foreground)]">
                Thông báo
              </PopoverTitle>
              <PopoverDescription className="mt-0.5 text-xs text-[var(--text-muted)]">
                {totalBadgeCount > 0
                  ? "Các yêu cầu và cập nhật mới"
                  : "Bạn đã xem hết thông báo"}
              </PopoverDescription>
            </div>
            {totalBadgeCount > 0 && (
              <span className="rounded-md bg-[var(--surface-secondary)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                {totalBadgeCount} mục
              </span>
            )}
          </header>

          <div className="border-b border-[var(--border)] p-3">
            <DailyReminderControls
              initialState={reminderState}
              variant="compact"
              highlighted={highlightControls}
            />
          </div>

          <div
            className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto overscroll-contain"
            role="list"
            aria-label="Danh sách thông báo"
          >
            {guideNotificationNode}
            {notificationItems}
            {emptyNotification}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
