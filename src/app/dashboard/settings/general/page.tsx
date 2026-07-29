import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
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

  const activeCategoryCount = categories.filter((c) => c.status === "active").length;

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container">
        {/* Page Header */}
        <PageHeader
          eyebrow="Cài đặt cá nhân"
          title="Giao diện & Danh mục mẫu"
          description="Tùy chỉnh phong cách giao diện và quản lý bộ danh mục mẫu cá nhân để import vào workspace."
        />

        {/* Content sections */}
        <div className="settings-sections-grid mt-6 space-y-6">
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
