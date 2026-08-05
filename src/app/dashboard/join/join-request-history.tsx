"use client";

import { Clock, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { Empty } from "@/components/base";

export type JoinRequestItem = {
  id: string;
  workspaceName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  respondedAt: string | null;
};

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Đang chờ duyệt",
    className: "text-[var(--warning)]",
  },
  approved: {
    icon: CheckCircle2,
    label: "Đã được duyệt",
    className: "text-[var(--success)]",
  },
  rejected: {
    icon: XCircle,
    label: "Bị từ chối",
    className: "text-[var(--danger)]",
  },
} as const;

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function JoinRequestHistory({ requests }: { requests: JoinRequestItem[] }) {
  if (requests.length === 0) {
    return (
      <Empty
        variant="compact"
        icon={Inbox}
        title="Chưa có yêu cầu nào"
        description="Khi bạn gửi mã mời, yêu cầu sẽ hiển thị ở đây."
        className="min-h-52"
      />
    );
  }

  return (
    <div className="max-h-[32rem] divide-y divide-[var(--border)] overflow-y-auto">
      {requests.map((req) => {
        const cfg = STATUS_CONFIG[req.status];
        const Icon = cfg.icon;
        return (
          <article
            key={req.id}
            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)]">
              <Icon
                className={cfg.className}
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
                {req.workspaceName}
              </h3>
              <time
                dateTime={req.createdAt}
                className="mt-1 block text-xs text-[var(--text-muted)]"
              >
                Gửi {formatRelativeTime(req.createdAt)}
              </time>
            </div>
            <span className={`shrink-0 text-xs font-semibold ${cfg.className}`}>
              {cfg.label}
            </span>
          </article>
        );
      })}
    </div>
  );
}
