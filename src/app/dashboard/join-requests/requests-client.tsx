import { Check, ChevronRight, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { reviewJoinAction } from "@/app/dashboard/join/actions";
import {
  Button,
  Card,
  Empty,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/base";
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

export function JoinRequestsClient({
  requests,
  roles,
}: {
  requests: Request[];
  roles: Role[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaultRoleCode =
    roles.find((role) => role.code === "MEMBER")?.code ?? roles[0]?.code ?? "";
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>(
    {},
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const selectedRequest = requests.find((request) => request.id === selectedRequestId);

  function review(id: string, approve: boolean, roleCode?: string) {
    start(async () => {
      const r = await reviewJoinAction({ requestId: id, approve, roleCode });
      if (r.ok) {
        toast.success("Đã xử lý yêu cầu tham gia.");
        setSelectedRequestId(null);
        router.refresh();
      } else {
        toast.error(r.message ?? "Không thể xử lý yêu cầu.");
      }
    });
  }

  return (
    <>
      <Card
        as="section"
        className="workspace-join-section gap-4 overflow-hidden"
        data-empty={requests.length === 0}
      >
      <header className="member-management-header flex items-center gap-3">
        <div className="settings-section-icon">
          <UserPlus size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            Yêu cầu tham gia
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Chọn vai trò trước khi cấp quyền truy cập workspace.
          </p>
        </div>
        <span className="ws-fixed-pill">
          <strong>{requests.length}</strong> đang chờ
        </span>
      </header>
      <div className="settings-member-list">
        {requests.map((r) => (
          <Fragment key={r.id}>
            <Button
              type="button"
              variant="unstyled"
              size="auto"
              className="member-mobile-row join-request-mobile-row"
              onClick={() => setSelectedRequestId(r.id)}
              aria-label={`Xử lý yêu cầu của ${r.username}`}
            >
              <span
                className="member-avatar"
                style={{ background: avatarGradient(r.username) }}
                aria-hidden="true"
              >
                {r.username.slice(0, 1)}
              </span>
              <span className="member-identity">
                <strong>{r.username}</strong>
                <small className="member-mobile-summary">Chờ duyệt</small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </Button>

            <article className="settings-member-row join-request-desktop-row">
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
                <small className="member-mobile-summary">Chờ duyệt</small>
              </div>

              {/* Role selection dropdown */}
              <div className="member-role">
                <Select
                  value={selectedRoles[r.id] ?? defaultRoleCode}
                  spotlight
                  onValueChange={(roleCode) =>
                    setSelectedRoles((current) => ({
                      ...current,
                      [r.id]: roleCode,
                    }))
                  }
                  options={roles.map((role) => ({
                    value: role.code,
                    label: role.name,
                  }))}
                  className="member-role-select w-auto min-w-34"
                />
              </div>

              {/* Actions */}
              <div className="join-request-actions flex items-center gap-2 justify-end">
                <Button
                  disabled={pending}
                  onClick={() => review(r.id, false)}
                  variant="icon"
                  size="icon"
                  title="Từ chối yêu cầu"
                  aria-label="Từ chối yêu cầu"
                >
                  <X size={16} />
                </Button>
                <Button
                  disabled={pending}
                  onClick={() =>
                    review(r.id, true, selectedRoles[r.id] ?? defaultRoleCode)
                  }
                  variant="icon"
                  size="icon"
                  title="Duyệt tham gia"
                  aria-label="Duyệt tham gia"
                >
                  <Check size={16} />
                </Button>
              </div>
            </article>
          </Fragment>
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

      <Sheet
        open={selectedRequest !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="ledger-mobile-review-sheet member-management-sheet"
        >
          {selectedRequest && (
            <>
              <SheetHeader className="ledger-mobile-review-header">
                <div className="ledger-mobile-review-heading">
                  <span aria-hidden="true">
                    <UserPlus size={18} />
                  </span>
                  <div>
                    <SheetTitle>Yêu cầu tham gia</SheetTitle>
                    <SheetDescription>
                      Chọn vai trò trước khi cấp quyền truy cập.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="ledger-mobile-review-body member-management-sheet-body">
                <div className="ledger-mobile-review-transaction">
                  <div>
                    <span>{selectedRequest.username}</span>
                    <small>Đang chờ được phê duyệt</small>
                  </div>
                  <strong>Chờ duyệt</strong>
                </div>

                <Select
                  label="Vai trò"
                  spotlight
                  value={selectedRoles[selectedRequest.id] ?? defaultRoleCode}
                  onValueChange={(roleCode) =>
                    setSelectedRoles((current) => ({
                      ...current,
                      [selectedRequest.id]: roleCode,
                    }))
                  }
                  options={roles.map((role) => ({
                    value: role.code,
                    label: role.name,
                  }))}
                  className="w-full"
                />
              </div>

              <SheetFooter className="ledger-mobile-review-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="ledger-mobile-review-reject"
                  disabled={pending}
                  onClick={() => review(selectedRequest.id, false)}
                >
                  Từ chối
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    review(
                      selectedRequest.id,
                      true,
                      selectedRoles[selectedRequest.id] ?? defaultRoleCode,
                    )
                  }
                >
                  Chấp nhận
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
