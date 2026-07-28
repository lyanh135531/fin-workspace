"use client";

import { UserPlus } from "lucide-react";
import { useTransition } from "react";
import { createMemberAccountAction } from "@/app/dashboard/users/actions";
import { Button, Card } from "@/components/base";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Workspace = { id: string; name: string };

export function MemberAccountForm({ workspaces }: { workspaces: Workspace[] }) {
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    const workspaceIds = form.getAll("workspaceIds").map(String);
    start(async () => {
      const result = await createMemberAccountAction({
        username: form.get("username"),
        password: form.get("password"),
        workspaceIds,
      });
      if (result.ok) {
        toast.success("Đã tạo tài khoản Member và cấp quyền workspace đã chọn.");
        (document.getElementById("member-account-form") as HTMLFormElement | null)?.reset();
      } else {
        toast.error(result.message ?? "Không thể tạo tài khoản.");
      }
    });
  }

  return (
    <Card as="section" className="sunrise-card gap-0 p-6">
      <div className="flex items-start gap-3">
        <span className="settings-section-icon"><UserPlus size={18}/></span>
        <div>
          <p className="settings-eyebrow">Quản lý tài khoản</p>
          <h1 className="mt-1 text-2xl font-semibold">Tạo tài khoản thành viên</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Tài khoản mới sẽ là Member. Chỉ các workspace bạn đang là Admin mới có thể được cấp quyền.
          </p>
        </div>
      </div>
      <form id="member-account-form" action={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Username
          <Input className="mt-2" required name="username" minLength={3} maxLength={80} autoComplete="username" placeholder="Ví dụ: minh"/>
        </label>
        <label className="text-sm font-medium">
          Mật khẩu ban đầu
          <Input className="mt-2" required name="password" type="password" minLength={6} maxLength={128} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự"/>
        </label>
        <fieldset className="rounded-xl border border-[var(--border)] p-4 md:col-span-2">
          <legend className="px-1 text-sm font-medium">Workspace được quyền tham gia</legend>
          <p className="mt-1 text-sm text-slate-500">Chọn một hoặc nhiều workspace.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {workspaces.map((workspace) => (
              <label key={workspace.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm">
                <input name="workspaceIds" type="checkbox" value={workspace.id} className="accent-[var(--coral)]"/>
                <span>{workspace.name}</span>
                <small className="ml-auto text-slate-500">Member</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-end gap-3 md:col-span-2">
          <Button disabled={pending} variant="default">
            <UserPlus size={17}/>
            {pending ? "Đang tạo..." : "Tạo tài khoản"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
