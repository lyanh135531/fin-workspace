import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { GeneralSettingsClient } from "@/app/dashboard/settings/general-settings-client";
import { UserCategoryTemplateManagement } from "@/app/dashboard/settings/global-category-management";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/base";

export default async function GeneralSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");

  const categories = await prisma.category.findMany({
    where: { workspaceId: null, userId: session.user.id, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <div className="max-sm:hidden min-[901px]:hidden">
          <PageHeader
            eyebrow="Cài đặt cá nhân"
            title="Giao diện & Danh mục mẫu"
            description="Tùy chỉnh giao diện và quản lý bộ danh mục mẫu cá nhân để dùng trong nhóm tài chính."
          />
        </div>
        <div className="hidden min-[901px]:block">
          <PageHeader
            eyebrow="Cài đặt cá nhân"
            title="Cài đặt chung"
            description="Thiết lập giao diện và chuẩn hóa danh mục dùng lại cho các nhóm tài chính của bạn."
            className="mb-6 pb-0"
            border={false}
          />
        </div>

        <div className="settings-sections-grid space-y-6 sm:mt-6 min-[901px]:mt-0 min-[901px]:space-y-5">
          <GeneralSettingsClient />
          <UserCategoryTemplateManagement
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
              code: category.code,
              color: category.color,
              type: category.type,
              icon: category.icon,
              parentId: category.parentId,
              sortOrder: category.sortOrder,
              status: category.status,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
