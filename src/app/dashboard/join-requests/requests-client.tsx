"use client";

import { useTransition } from "react";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { showToast } from "@/components/toast-container";

type Role = { code: string; name: string };
type Request = { id: string; username: string };

export function JoinRequestsClient({ requests, roles }: { requests: Request[]; roles: Role[] }) {
  const [pending, start] = useTransition();

  function review(id: string, approve: boolean, roleCode?: string) {
    start(async () => {
      const r = await reviewJoinAction({ requestId: id, approve, roleCode });
      if (r.ok) {
        showToast("Đã xử lý yêu cầu tham gia.", "success");
      } else {
        showToast(r.message ?? "Không thể xử lý yêu cầu.", "error");
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
            <button disabled={pending} onClick={() => review(r.id, false)} className="button-secondary">
              Từ chối
            </button>
            <button
              disabled={pending}
              onClick={() => review(r.id, true, (document.getElementById(`role-${r.id}`) as HTMLSelectElement)?.value)}
              className="button-primary"
            >
              Duyệt
            </button>
          </div>
        </article>
      ))}
      {requests.length === 0 && (
        <div className="sunrise-card p-8 text-center text-slate-500">Không có yêu cầu chờ duyệt.</div>
      )}
    </div>
  );
}
