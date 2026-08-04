import { UserPlus, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import { Button, Card, Empty, Select } from "@/components/base";
import { toast } from "sonner";

type Role = { code: string; name: string };
type Request = { id: string; username: string };

/* Deterministic gradient from username for avatar */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #FF5B3D, #FF8A65)",
  "linear-gradient(135deg, #1677B8, #4FC3F7)",
  "linear-gradient(135deg, #7959C8, #B39DDB)",
  "linear-gradient(135deg, #2F7D5B, #66BB6A)",
  "linear-gradient(135deg, #334E8C, #5C6BC0)",
  "linear-gradient(135deg, #E58EB3, #F48FB1)",
  "linear-gradient(135deg, #008E9B, #4DD0E1)",
  "linear-gradient(135deg, #D6A53A, #FFD54F)",
];

function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

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
    <Card as="section" className="gap-4 overflow-hidden">
      <header className="flex items-center gap-3">
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
        <article className="settings-member-row" key={r.id}>
          {/* Avatar */}
          <div
            className="member-avatar"
            style={{ background: avatarGradient(r.username) }}
            aria-hidden="true"
          >
            {r.username.slice(0, 1)}
          </div>

          {/* Identity */}
          <div className="member-identity">
            <strong>{r.username}</strong>
            <span>Đang chờ được phê duyệt</span>
          </div>

          {/* Role selection dropdown */}
          <div className="member-role">
            <Select
              value={selectedRoles[r.id] ?? defaultRoleCode}
              onValueChange={(roleCode) =>
                setSelectedRoles((current) => ({ ...current, [r.id]: roleCode }))
              }
              label={`Vai trò cấp cho ${r.username}`}
              options={roles.map((role) => ({ value: role.code, label: role.name }))}
              className="w-auto min-w-34"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <Button
              disabled={pending}
              onClick={() => review(r.id, false)}
              variant="outline"
              size="icon"
              className="h-9 w-9 text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 hover:border-rose-200 transition-colors"
              title="Từ chối yêu cầu"
              aria-label="Từ chối yêu cầu"
            >
              <X size={16} />
            </Button>
            <Button
              disabled={pending}
              onClick={() => review(r.id, true, selectedRoles[r.id] ?? defaultRoleCode)}
              variant="default"
              size="icon"
              className="h-9 w-9"
              title="Duyệt tham gia"
              aria-label="Duyệt tham gia"
            >
              <Check size={16} />
            </Button>
          </div>
        </article>
      ))}
      {requests.length === 0 && (
        <Empty
          variant="compact"
          icon={UserPlus}
          title="Không có yêu cầu chờ duyệt"
          description="Các yêu cầu tham gia workspace mới sẽ xuất hiện tại đây."
          className="rounded-none border-x-0 border-b-0"
        />
      )}
      </div>
    </Card>
  );
}
