import { CirclePlus, KeyRound, UserPlus } from "lucide-react";
import { Card } from "@/components/base";

export function GeneralWorkspaceActions({ canCreateMember }: { canCreateMember: boolean }) {
  return (
    <Card as="section" className="sunrise-card gap-0 mt-6 p-6">
      <p className="settings-eyebrow">Workspace & quyền truy cập</p>
      <h2 className="mt-1 text-xl font-semibold">Thao tác workspace</h2>
      <p className="mt-2 text-sm text-slate-500">
        Tạo workspace mới, tham gia workspace bằng mã mời hoặc cấp tài khoản cho thành viên.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card as="a" className="general-action-card gap-0 py-0" href="/workspaces/create">
          <span className="settings-section-icon"><CirclePlus size={18}/></span>
          <strong>Tạo workspace</strong>
          <small>Bạn trở thành Admin của workspace mới.</small>
        </Card>
        <Card as="a" className="general-action-card gap-0 py-0" href="/settings/join">
          <span className="settings-section-icon"><KeyRound size={18}/></span>
          <strong>Tham gia workspace</strong>
          <small>Gửi yêu cầu bằng mã mời do Admin chia sẻ.</small>
        </Card>
        {canCreateMember && (
          <Card as="a" className="general-action-card gap-0 py-0" href="/settings/users">
            <span className="settings-section-icon"><UserPlus size={18}/></span>
            <strong>Tạo tài khoản thành viên</strong>
            <small>Cấp quyền Member cho workspace bạn quản trị.</small>
          </Card>
        )}
      </div>
    </Card>
  );
}
