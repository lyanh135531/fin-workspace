"use client";

import { useTransition } from "react";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Role = { code: string; name: string };
type Request = { id: string; username: string };

export function JoinRequestsClient({ requests, roles }: { requests: Request[]; roles: Role[] }) {
  const [pending, start] = useTransition();

  function review(id: string, approve: boolean, roleCode?: string) {
    start(async () => {
      const r = await reviewJoinAction({ requestId: id, approve, roleCode });
      if (r.ok) {
        toast.success("Đã xử lý yêu cầu tham gia.");
      } else {
        toast.error(r.message ?? "Không thể xử lý yêu cầu.");
      }
    });
  }

  return (
    <div className="mt-6 space-y-3">
      {requests.map((r) => (
        <article className="sunrise-card flex flex-wrap items-center justify-between gap-3 p-5" key={r.id}>
          <strong>{r.username}</strong>
          <div className="flex gap-2">
            <select id={`role-${r.id}`} className="field w-auto">
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
            <Button disabled={pending} onClick={() => review(r.id, false)} variant="outline" size="sm">
              Từ chối
            </Button>
            <Button
              disabled={pending}
              onClick={() => review(r.id, true, (document.getElementById(`role-${r.id}`) as HTMLSelectElement)?.value)}
              variant="default"
              size="sm"
            >
              Duyệt
            </Button>
          </div>
        </article>
      ))}
      {requests.length === 0 && (
        <div className="sunrise-card p-8 text-center text-slate-500">Không có yêu cầu chờ duyệt.</div>
      )}
    </div>
  );
}
