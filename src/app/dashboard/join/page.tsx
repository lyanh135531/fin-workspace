import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { HelpCircle, History } from "lucide-react";
import { authOptions } from "@/auth";
import { JoinForm } from "@/app/dashboard/join/join-form";
import { JoinRequestHistory } from "@/app/dashboard/join/join-request-history";
import { getUserJoinRequests } from "@/services/join-request-query";

export default async function JoinPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");

  const requests = await getUserJoinRequests(session.user.id);

  const serialized = requests.map((r) => ({
    id: r.id,
    workspaceName: r.workspaceName,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
  }));

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="join-page">
      <div className="join-page-container">

        {/* Hero */}
        <header className="join-page-hero">
          <div>
            <p className="settings-eyebrow">Tham gia Workspace</p>
            <h1>Nhập mã mời để tham gia</h1>
            <p className="join-hero-copy">
              Dán mã mời do Admin workspace chia sẻ. Yêu cầu của bạn sẽ được Admin xét duyệt trước khi bạn có quyền hoạt động.
            </p>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="join-page-grid">
          {/* Left: Form */}
          <div className="join-page-form-col">
            <JoinForm />

            {/* Help section */}
            <div className="join-help-card">
              <div className="join-help-icon">
                <HelpCircle size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h3>Làm sao để lấy mã mời?</h3>
                <p>
                  Admin của workspace sẽ chia sẻ mã mời cho bạn. Mã mời có thể được tìm thấy
                  trong mục <strong>Cài đặt workspace → Mã mời workspace</strong>.
                </p>
                <p>
                  Mã có dạng UUID, ví dụ: <code>a1b2c3d4-e5f6-7890-abcd-ef1234567890</code>
                </p>
              </div>
            </div>
          </div>

          {/* Right: History */}
          <div className="join-page-history-col">
            <div className="join-history-card">
              <div className="join-history-header">
                <div className="join-history-title-row">
                  <History size={16} strokeWidth={2} />
                  <h2>Lịch sử yêu cầu</h2>
                </div>
                {pendingCount > 0 && (
                  <span className="join-history-pending-badge">{pendingCount} đang chờ</span>
                )}
              </div>
              <JoinRequestHistory requests={serialized} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
