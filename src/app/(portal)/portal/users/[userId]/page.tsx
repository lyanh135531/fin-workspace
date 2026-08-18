import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Button, Card, PageHeader } from "@/components/base";
import { Badge } from "@/components/ui/badge";
import { idSchema } from "@/domain/common/schemas";
import { env } from "@/lib/env";
import { requirePlatformAdminSession } from "@/services/platform-access";
import { getPortalUserById } from "@/services/platform-user-query";

type UserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: env.APP_TIME_ZONE,
});

export default async function PortalUserDetailPage({ params }: UserDetailPageProps) {
  await requirePlatformAdminSession();
  const { userId } = await params;

  if (!idSchema.safeParse(userId).success) notFound();

  const user = await getPortalUserById(userId);

  if (!user) notFound();

  const fields = [
    ["ID", user.id],
    ["Username", user.username],
    ["Ngày tạo", dateTimeFormatter.format(user.createdAt)],
    ["Cập nhật cuối", dateTimeFormatter.format(user.updatedAt)],
    ["Ngày xóa", user.deletedAt ? dateTimeFormatter.format(user.deletedAt) : "Chưa xóa"],
  ] as const;

  return (
    <div>
      <PageHeader
        title={user.username}
        description="Thông tin tài khoản cơ bản. Không có dữ liệu workspace hoặc tài chính trên trang này."
      >
        <Button variant="ghost" render={<Link href="/portal/users" />}>
          <ArrowLeft aria-hidden />
          Danh sách user
        </Button>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="font-semibold">Hồ sơ tài khoản</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Chế độ chỉ đọc</p>
          </div>
          <Badge variant={user.status === "active" ? "outline" : "destructive"}>
            {user.status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}
          </Badge>
        </div>

        <dl className="divide-y divide-[var(--border)]">
          {fields.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm font-medium text-[var(--text-muted)]">{label}</dt>
              <dd className="[overflow-wrap:anywhere] text-sm text-[var(--foreground)] sm:text-right">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
