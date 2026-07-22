"use client";

import { Clock, CheckCircle2, XCircle, Inbox } from "lucide-react";

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
    className: "join-status-pending",
  },
  approved: {
    icon: CheckCircle2,
    label: "Đã được duyệt",
    className: "join-status-approved",
  },
  rejected: {
    icon: XCircle,
    label: "Bị từ chối",
    className: "join-status-rejected",
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
      <div className="join-history-empty">
        <Inbox size={36} strokeWidth={1.2} />
        <p>Chưa có yêu cầu nào</p>
        <small>Khi bạn gửi mã mời, yêu cầu sẽ hiển thị ở đây.</small>
      </div>
    );
  }

  return (
    <div className="join-history-list">
      {requests.map((req) => {
        const cfg = STATUS_CONFIG[req.status];
        const Icon = cfg.icon;
        return (
          <div key={req.id} className={`join-history-item ${cfg.className}`}>
            <div className="join-history-icon-wrap">
              <Icon size={16} strokeWidth={2} />
            </div>
            <div className="join-history-detail">
              <span className="join-history-ws-name">{req.workspaceName}</span>
              <span className="join-history-meta">
                {cfg.label} · {formatRelativeTime(req.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
