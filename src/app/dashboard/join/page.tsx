import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CircleHelp, History, ShieldCheck, UserRoundCheck } from "lucide-react";

import { authOptions } from "@/auth";
import { JoinForm } from "@/app/dashboard/join/join-form";
import { JoinRequestHistory } from "@/app/dashboard/join/join-request-history";
import { Card, PageContainer, PageHeader } from "@/components/base";
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
    <PageContainer className="mx-auto max-w-6xl pb-6">
      <PageHeader
        title="Tham gia nhóm tài chính"
        description="Nhập mã mời từ quản trị viên để gửi yêu cầu tham gia nhóm."
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <section className="min-w-0 space-y-4 lg:col-span-7">
          <JoinForm />

          <Card as="aside" size="sm">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--info)]">
                <CircleHelp size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-[var(--foreground)]">
                  Mã mời hoạt động thế nào?
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck
                      className="mt-0.5 shrink-0 text-[var(--primary)]"
                      size={16}
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      Lấy mã 6 số từ quản trị viên, ví dụ{" "}
                      <code className="font-mono font-semibold text-[var(--foreground)]">
                        892-415
                      </code>
                      .
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <UserRoundCheck
                      className="mt-0.5 shrink-0 text-[var(--primary)]"
                      size={16}
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      Sau khi gửi, quản trị viên cần duyệt trước khi bạn có
                      quyền truy cập.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <Card as="aside" className="gap-0 p-0 lg:sticky lg:top-6 lg:col-span-5">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <History
                className="text-[var(--text-muted)]"
                size={17}
                aria-hidden="true"
              />
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">
                  Lịch sử yêu cầu
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Theo dõi các lần bạn đã gửi
                </p>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="shrink-0 rounded-md bg-[var(--surface-secondary)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
                {pendingCount} đang chờ
              </span>
            )}
          </header>
          <JoinRequestHistory requests={serialized} />
        </Card>
      </div>
    </PageContainer>
  );
}
