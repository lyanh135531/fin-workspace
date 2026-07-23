import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
import { authOptions } from "@/auth";
import { GeneralSettingsClient } from "@/app/dashboard/settings/general-settings-client";
import { UserCategoryTemplateManagement } from "@/app/dashboard/settings/global-category-management";
import { prisma } from "@/lib/prisma";

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
        {/* Hero Banner Header */}
        <header className="settings-hero">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="settings-badge">
                <Palette size={13} className="text-[var(--primary)]" />
                Cài đặt cá nhân
              </span>
            </div>
            <h1>Giao diện &amp; Danh mục mẫu</h1>
            <p className="settings-hero-copy">
              Tùy chỉnh phong cách giao diện và quản lý bộ danh mục mẫu cá nhân để import vào workspace.
            </p>
          </div>
          <div className="settings-summary" aria-label="Tổng quan">
            <span>
              <Palette size={14} className="inline mr-1 text-[var(--primary)]" />
              <strong>5</strong> Chủ đề màu
            </span>
            <span>
              <strong>{activeCategoryCount}</strong> / {categories.length} Danh mục mẫu
            </span>
          </div>
        </header>

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
