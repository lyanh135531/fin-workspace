"use client";

import {
  ChevronRight,
  ShieldCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { Fragment, useEffect, useState, useTransition } from "react";
import {
  changeMemberRoleAction,
  removeMemberAction,
} from "@/app/dashboard/settings/actions";
import {
  Button,
  Card,
  ConfirmDelete,
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
type Member = {
  id: string;
  username: string;
  roleCode: string;
  isSelf: boolean;
};

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

function roleBadgeClass(code: string): string {
  if (code === "ADMIN") return "ws-role-badge ws-role-badge-admin rounded-2xl";
  return "ws-role-badge ws-role-badge-member rounded-2xl";
}

export function SettingsClient({
  roles,
  members,
  isAdmin,
}: {
  roles: Role[];
  members: Member[];
  isAdmin: boolean;
}) {
  const [pending, start] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const selectedMember = members.find(
    (member) => member.id === selectedMemberId,
  );
  const selectedMemberRoleName = selectedMember
    ? (roles.find((role) => role.code === selectedMember.roleCode)?.name ??
      selectedMember.roleCode)
    : "";
  const canManageSelectedMember =
    selectedMember !== undefined && isAdmin && !selectedMember.isSelf;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const updateViewport = () => setIsDesktop(query.matches);
    updateViewport();
    query.addEventListener("change", updateViewport);
    return () => query.removeEventListener("change", updateViewport);
  }, []);

  function changeRole(id: string, roleCode: string) {
    start(async () => {
      const result = await changeMemberRoleAction({ memberId: id, roleCode });
      if (result.ok) {
        toast.success("Đã cập nhật vai trò thành viên.");
        setSelectedMemberId(null);
      } else {
        toast.error(result.message ?? "Không thể cập nhật vai trò.");
      }
    });
  }

  async function remove(id: string): Promise<boolean> {
    setRemovingId(id);
    try {
      const result = await removeMemberAction(id);
      if (result.ok) {
        toast.success("Đã gỡ thành viên khỏi workspace.");
        setSelectedMemberId(null);
        setConfirmingRemove(false);
        return true;
      }
      toast.error(result.message ?? "Không thể gỡ thành viên.");
      return false;
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <Card
        as="section"
        className="workspace-members-section gap-4 overflow-hidden min-[901px]:gap-0"
        aria-busy={pending || removingId !== null}
      >
        {/* Header */}
        <header className="member-management-header flex items-center gap-3 min-[901px]:pb-5">
          <div className="settings-section-icon">
            <UsersRound size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] min-[901px]:text-base min-[901px]:font-semibold">
              Thành viên workspace
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Quản lý vai trò và quyền hoạt động của từng tài khoản.
            </p>
          </div>
          <span className="ws-fixed-pill rounded-2xl min-[901px]:text-xs min-[901px]:font-medium min-[901px]:text-[var(--text-muted)]">
            <strong>{members.length}</strong> người
          </span>
        </header>

        {/* Member list */}
        <div className="settings-member-list">
          {members.map((member) => {
            const roleName =
              roles.find((r) => r.code === member.roleCode)?.name ??
              member.roleCode;
            return (
              <Fragment key={member.id}>
                <Button
                  type="button"
                  variant="unstyled"
                  size="auto"
                  className="member-mobile-row workspace-member-mobile-row"
                  onClick={() => {
                    setConfirmingRemove(false);
                    setSelectedMemberId(member.id);
                  }}
                  aria-label={`Xem thông tin ${member.username}`}
                >
                  <span
                    className="ws-member-avatar"
                    style={{ background: avatarGradient(member.username) }}
                    aria-hidden="true"
                  >
                    {member.username.slice(0, 1)}
                  </span>
                  <span className="member-identity">
                    <span className="flex items-center gap-2">
                      <strong>{member.username}</strong>
                      {member.isSelf && (
                        <span className="text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded-md">
                          Bạn
                        </span>
                      )}
                    </span>
                    <small className="member-mobile-summary">{roleName}</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Button>

                <article className="settings-member-row workspace-member-desktop-row min-[901px]:grid-cols-[2.5rem_minmax(0,1fr)_10rem_2.5rem] min-[901px]:gap-4 min-[901px]:py-3.5">
                  {/* Avatar */}
                  <div
                    className="ws-member-avatar bg-[var(--primary-soft)] text-[var(--primary)]"
                    aria-hidden="true"
                  >
                    {member.username.slice(0, 1)}
                  </div>

                  {/* Identity */}
                  <div className="member-identity">
                    <div className="flex items-center gap-2">
                      <strong>{member.username}</strong>
                      {member.isSelf && (
                        <span className="text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded-md">
                          Bạn
                        </span>
                      )}
                    </div>
                    <span>
                      {member.isSelf
                        ? "Tài khoản của bạn"
                        : "Đang có quyền truy cập"}
                    </span>
                    <small className="member-mobile-summary">{roleName}</small>
                  </div>

                  {/* Role */}
                  <div className="member-role">
                    {isAdmin && !member.isSelf ? (
                      <Select
                        key={isDesktop ? "desktop" : "mobile"}
                        value={member.roleCode}
                        spotlight={!isDesktop}
                        disabled={pending}
                        onValueChange={(roleCode) =>
                          changeRole(member.id, roleCode)
                        }
                        options={roles.map((role) => ({
                          value: role.code,
                          label: role.name,
                        }))}
                        className="member-role-select min-w-34 min-[901px]:w-40"
                      />
                    ) : (
                      <span
                        className={`${roleBadgeClass(member.roleCode)} min-[901px]:w-40 min-[901px]:justify-center`}
                      >
                        <ShieldCheck size={13} />
                        {roleName}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="member-actions">
                    {member.isSelf
                      ? null
                      : isAdmin && (
                          <>
                            <div className="min-[901px]:hidden">
                              <Button
                                type="button"
                                disabled={pending || removingId !== null}
                                variant="destructive"
                                size="icon"
                                title={`Gỡ ${member.username} khỏi workspace`}
                                aria-label={`Gỡ ${member.username} khỏi workspace`}
                                onClick={() => {
                                  setSelectedMemberId(member.id);
                                  setConfirmingRemove(true);
                                }}
                              >
                                <UserRoundX size={16} />
                              </Button>
                            </div>
                            <div className="hidden min-[901px]:block">
                              <ConfirmDelete
                                ariaLabel={`Gỡ ${member.username} khỏi workspace`}
                                title="Gỡ thành viên?"
                                description={
                                  <>
                                    <strong>{member.username}</strong> sẽ mất
                                    quyền truy cập workspace này.
                                  </>
                                }
                                confirmLabel="Gỡ thành viên"
                                disabled={pending || removingId !== null}
                                onConfirm={() => remove(member.id)}
                                trigger={
                                  <Button
                                    type="button"
                                    disabled={pending || removingId !== null}
                                    variant="destructiveIcon"
                                    size="icon"
                                    title={`Gỡ ${member.username} khỏi workspace`}
                                    aria-label={`Gỡ ${member.username} khỏi workspace`}
                                  >
                                    <UserRoundX size={16} />
                                  </Button>
                                }
                              />
                            </div>
                          </>
                        )}
                  </div>
                </article>
              </Fragment>
            );
          })}
          {members.length === 0 && (
            <Empty
              variant="compact"
              icon={UsersRound}
              title="Workspace chưa có thành viên"
              description="Thành viên được cấp quyền sẽ xuất hiện tại đây."
              className="rounded-none border-x-0 border-b-0"
            />
          )}
        </div>
      </Card>

      <Sheet
        open={selectedMember !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMemberId(null);
            setConfirmingRemove(false);
          }
        }}
      >
        <SheetContent
          side="bottom"
          className={`ledger-mobile-review-sheet member-management-sheet w-[min(36rem,calc(100vw-1rem))]! max-w-none! overflow-hidden! border border-[var(--border)]! bg-[var(--surface)]! p-0!${confirmingRemove ? " pending-delete" : ""}`}
        >
          {selectedMember && (
            <>
              <SheetHeader className="ledger-mobile-review-header">
                <div className="ledger-mobile-review-heading">
                  <span aria-hidden="true">
                    {confirmingRemove ? (
                      <UserRoundX size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                  </span>
                  <div>
                    <SheetTitle>
                      {confirmingRemove
                        ? "Gỡ thành viên?"
                        : selectedMember.username}
                    </SheetTitle>
                    <SheetDescription>
                      {confirmingRemove
                        ? `${selectedMember.username} sẽ mất quyền truy cập workspace.`
                        : canManageSelectedMember
                          ? "Quản lý vai trò và quyền truy cập workspace."
                          : "Thông tin vai trò trong workspace."}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="ledger-mobile-review-body member-management-sheet-body">
                <div className="ledger-mobile-review-transaction rounded-2xl">
                  <div>
                    <span>{selectedMember.username}</span>
                    <small>Thành viên workspace</small>
                  </div>
                  <strong>{selectedMemberRoleName}</strong>
                </div>

                {!confirmingRemove && canManageSelectedMember && (
                  <Select
                    label="Vai trò"
                    value={selectedMember.roleCode}
                    disabled={pending}
                    onValueChange={(roleCode) =>
                      changeRole(selectedMember.id, roleCode)
                    }
                    options={roles.map((role) => ({
                      value: role.code,
                      label: role.name,
                    }))}
                    className="w-full"
                  />
                )}
              </div>

              <SheetFooter
                className={`ledger-mobile-review-actions${canManageSelectedMember ? "" : " member-management-actions-single"}`}
              >
                {confirmingRemove ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || removingId !== null}
                      onClick={() => setConfirmingRemove(false)}
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="ledger-mobile-review-approve"
                      data-delete
                      disabled={pending || removingId !== null}
                      onClick={() => void remove(selectedMember.id)}
                    >
                      Gỡ thành viên
                    </Button>
                  </>
                ) : canManageSelectedMember ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedMemberId(null)}
                    >
                      Đóng
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="ledger-mobile-review-approve"
                      data-delete
                      disabled={pending || removingId !== null}
                      onClick={() => setConfirmingRemove(true)}
                    >
                      <UserRoundX size={16} />
                      Gỡ thành viên
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedMemberId(null)}
                  >
                    Đóng
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
