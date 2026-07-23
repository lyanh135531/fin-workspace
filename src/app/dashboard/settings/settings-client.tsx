"use client";

import { ShieldCheck, UserRoundX, UsersRound } from "lucide-react";
import { useState, useTransition } from "react";
import { changeMemberRoleAction, removeMemberAction } from "@/app/dashboard/settings/actions";
import { showToast } from "@/components/toast-container";

type Role = { code: string; name: string };
type Member = { id: string; username: string; roleCode: string; isSelf: boolean };

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
  if (code === "owner") return "ws-role-badge ws-role-badge-owner";
  if (code === "admin") return "ws-role-badge ws-role-badge-admin";
  return "ws-role-badge ws-role-badge-member";
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

  function changeRole(id: string, roleCode: string) {
    start(async () => {
      const result = await changeMemberRoleAction({ memberId: id, roleCode });
      if (result.ok) {
        showToast("Đã cập nhật vai trò thành viên.", "success");
      } else {
        showToast(result.message ?? "Không thể cập nhật vai trò.", "error");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const result = await removeMemberAction(id);
      if (result.ok) {
        showToast("Đã gỡ thành viên khỏi workspace.", "success");
      } else {
        showToast(result.message ?? "Không thể gỡ thành viên.", "error");
      }
    });
  }

  return (
    <section className="sunrise-card overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 p-6 pb-4">
        <div className="settings-section-icon">
          <UsersRound size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="settings-eyebrow">Quyền truy cập</p>
          <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] mt-0.5">
            Thành viên workspace
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý vai trò và quyền hoạt động của từng tài khoản.
          </p>
        </div>
        <span className="ws-fixed-pill">
          <strong>{members.length}</strong> người
        </span>
      </header>

      {/* Member list */}
      <div className="settings-member-list">
        {members.map((member) => {
          const roleName = roles.find((r) => r.code === member.roleCode)?.name ?? member.roleCode;
          return (
            <article key={member.id} className="settings-member-row">
              {/* Avatar */}
              <div
                className="ws-member-avatar"
                style={{ background: avatarGradient(member.username) }}
                aria-hidden="true"
              >
                {member.username.slice(0, 1)}
              </div>

              {/* Identity */}
              <div className="member-identity">
                <strong className="flex items-center gap-2">
                  {member.username}
                  {member.isSelf && (
                    <span className="text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded-md">
                      Bạn
                    </span>
                  )}
                </strong>
                <span>{member.isSelf ? "Tài khoản của bạn" : "Đang có quyền truy cập"}</span>
              </div>

              {/* Role */}
              <div className="member-role">
                {isAdmin && !member.isSelf ? (
                  <select
                    className="field"
                    value={member.roleCode}
                    disabled={pending}
                    aria-label={`Vai trò của ${member.username}`}
                    onChange={(event) => changeRole(member.id, event.target.value)}
                  >
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={roleBadgeClass(member.roleCode)}>
                    <ShieldCheck size={13} />
                    {roleName}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="member-actions">
                {member.isSelf ? null : (
                  isAdmin && (
                    <button
                      disabled={pending}
                      className="button-secondary icon-button !min-h-[34px] !min-w-[34px] !p-1.5 hover:text-rose-500 hover:border-rose-500/30"
                      title={`Gỡ ${member.username} khỏi workspace`}
                      aria-label={`Gỡ ${member.username} khỏi workspace`}
                      onClick={() => remove(member.id)}
                    >
                      <UserRoundX size={16} />
                    </button>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
