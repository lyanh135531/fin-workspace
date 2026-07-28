"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { Button, Card, Select } from "@/components/base";
import { toast } from "sonner";

type Role = { code: string; name: string };
type Request = { id: string; username: string };

export function JoinRequestsClient({ requests, roles }: { requests: Request[]; roles: Role[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaultRoleCode = roles.find((role) => role.code === "MEMBER")?.code ?? roles[0]?.code ?? "";
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  function review(id: string, approve: boolean, roleCode?: string) {
    start(async () => {
      const r = await reviewJoinAction({ requestId: id, approve, roleCode });
      if (r.ok) {
        toast.success("Đã xử lý yêu cầu tham gia.");
        router.refresh();
      } else {
        toast.error(r.message ?? "Không thể xử lý yêu cầu.");
      }
    });
  }

  return (
    <Card as="section" className="sunrise-card gap-0 py-0 overflow-hidden">
      <header className="flex items-center gap-3 p-6 pb-4">
        <div className="settings-section-icon">
          <UserPlus size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">Yêu cầu tham gia</h2>
          <p className="mt-0.5 text-xs text-slate-500">Chọn vai trò trước khi cấp quyền truy cập workspace.</p>
        </div>
        <span className="ws-fixed-pill"><strong>{requests.length}</strong> đang chờ</span>
      </header>
      <div className="settings-member-list">
      {requests.map((r) => (
        <article className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5 last:border-b-0" key={r.id}>
          <div>
            <strong>{r.username}</strong>
            <p className="mt-1 text-xs text-slate-500">Đang chờ được thêm vào workspace</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedRoles[r.id] ?? defaultRoleCode}
              onValueChange={(roleCode) =>
                setSelectedRoles((current) => ({ ...current, [r.id]: roleCode }))
              }
              label={`Vai trò cấp cho ${r.username}`}
              options={roles.map((role) => ({ value: role.code, label: role.name }))}
              className="w-auto min-w-34"
            />
            <Button disabled={pending} onClick={() => review(r.id, false)} variant="outline" size="default">
              Từ chối
            </Button>
            <Button
              disabled={pending}
              onClick={() => review(r.id, true, selectedRoles[r.id] ?? defaultRoleCode)}
              variant="default"
              size="default"
            >
              Duyệt
            </Button>
          </div>
        </article>
      ))}
      {requests.length === 0 && (
        <div className="border-t border-[var(--border)] p-8 text-center text-sm text-slate-500">Không có yêu cầu chờ duyệt.</div>
      )}
      </div>
    </Card>
  );
}
