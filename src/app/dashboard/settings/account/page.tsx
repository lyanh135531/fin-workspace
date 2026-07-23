import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { AccountSettingsClient } from "@/app/dashboard/settings/account-settings-client";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container">
        <header className="settings-hero">
          <div>
            <p className="settings-eyebrow">Tài khoản cá nhân</p>
            <h1>Cài đặt tài khoản</h1>
            <p className="settings-hero-copy">
              Quản lý thông tin hồ sơ cá nhân, đổi mật khẩu bảo mật và quản lý phiên làm việc.
            </p>
          </div>
        </header>

        <AccountSettingsClient username={session.user.username ?? "user"} />
      </div>
    </div>
  );
}
