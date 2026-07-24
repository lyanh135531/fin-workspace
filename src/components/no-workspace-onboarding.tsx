import Link from "next/link";
import { Building2, KeyRound, Plus, ArrowRight, Clock, Sparkles } from "lucide-react";
import { JoinRequestRecord } from "@/services/join-request-query";
import { Button } from "@/components/ui/button";

interface Props {
  username: string;
  joinRequests?: JoinRequestRecord[];
}

export function NoWorkspaceOnboarding({ username, joinRequests = [] }: Props) {
  const pendingRequests = joinRequests.filter((r) => r.status === "pending");

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6">
      {/* ── Welcome Hero Banner ── */}
      <section className="sunrise-card relative overflow-hidden p-6 sm:p-10">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--coral)]/20 bg-[var(--coral)]/10 px-3.5 py-1 text-xs font-semibold text-[var(--coral)]">
            <Sparkles size={14} />
            <span>Tài khoản mới · Chưa chọn Workspace</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
            Chào mừng bạn đến với Fin Workspace, <span className="text-[var(--coral)]">{username}</span>! 👋
          </h1>

          <p className="text-sm leading-relaxed text-slate-500 sm:text-base">
            Bạn hiện chưa thuộc về workspace nào. Bắt đầu ngay bằng cách tạo một không gian làm việc mới của riêng bạn hoặc tham gia vào workspace đã có của nhóm.
          </p>
        </div>
      </section>

      {/* ── Pending Requests Alert (If user has pending join requests) ── */}
      {pendingRequests.length > 0 && (
        <section className="sunrise-card border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <Clock size={18} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                  Bạn có {pendingRequests.length} yêu cầu tham gia đang chờ Admin duyệt
                </h3>
                <Link
                  href="/settings/join"
                  className="text-xs font-semibold text-amber-700 underline hover:text-amber-900 dark:text-amber-400"
                >
                  Xem chi tiết
                </Link>
              </div>
              <ul className="divide-y divide-amber-500/20 text-sm text-slate-600 dark:text-slate-300">
                {pendingRequests.map((req) => (
                  <li key={req.id} className="flex items-center justify-between py-2">
                    <span className="font-medium">{req.workspaceName}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Đang chờ duyệt
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ── Primary Action Cards ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Create Workspace */}
        <section className="sunrise-card flex flex-col justify-between p-6 sm:p-8 transition-transform hover:-translate-y-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--coral)]/15 text-[var(--coral)]">
                <Building2 size={24} />
              </div>
              <span className="rounded-full bg-[var(--coral)]/15 px-3 py-1 text-xs font-bold text-[var(--coral)]">
                Khuyên dùng
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                Tạo Workspace mới
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Tạo một không gian dữ liệu mới độc lập để quản lý ví tiền, danh mục thu chi, thành viên và duyệt giao dịch. Bạn sẽ trở thành <strong>Admin (Owner)</strong> của workspace này.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <Button render={<Link href="/workspaces/create" />} className="w-full justify-center">
              <Plus size={18} />
              Tạo Workspace ngay
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>

        {/* Card 2: Join Workspace */}
        <section className="sunrise-card flex flex-col justify-between p-6 sm:p-8 transition-transform hover:-translate-y-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
                <KeyRound size={24} />
              </div>
              <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-500">
                Dành cho thành viên
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                Tham gia bằng Mã mời
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Nhập Mã mời (Invite Code) do Admin workspace chia sẻ với bạn để gửi yêu cầu gia nhập vào nhóm hoặc tổ chức đã sẵn có.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="outline" render={<Link href="/settings/join" />} className="w-full justify-center">
              <KeyRound size={18} />
              Nhập mã tham gia
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      </div>

      {/* ── Getting Started Checklist ── */}
      <section className="sunrise-card p-6 sm:p-8">
        <h3 className="text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
          Quy trình 3 bước bắt đầu sử dụng Fin Workspace
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--coral)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--coral)] text-white text-[10px]">1</span>
              Bước 1 (Hiện tại)
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Tạo hoặc Tham gia Workspace</p>
            <p className="mt-1 text-xs text-slate-500">Khởi tạo dữ liệu riêng hoặc liên kết với tổ chức của bạn.</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 opacity-75">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-white text-[10px]">2</span>
              Bước 2
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Thiết lập Ví & Danh mục</p>
            <p className="mt-1 text-xs text-slate-500">Tạo các tài khoản thanh toán và tùy chỉnh nhóm thu chi.</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 opacity-75">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-white text-[10px]">3</span>
              Bước 3
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Ghi nhận Giao dịch</p>
            <p className="mt-1 text-xs text-slate-500">Bắt đầu nhập các khoản thu, chi và theo dõi báo cáo tài chính.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
