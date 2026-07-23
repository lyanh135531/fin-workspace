import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Palette, ShieldCheck } from "lucide-react";
import { authOptions } from "@/auth";
import { GeneralSettingsClient } from "@/app/dashboard/settings/general-settings-client";
import { GlobalCategoryManagement } from "@/app/dashboard/settings/global-category-management";
import { prisma } from "@/lib/prisma";

export default async function GeneralSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const categories = await prisma.category.findMany({
    where: { workspaceId: null, deletedAt: null },
    include: { _count: { select: { transactions: { where: { deletedAt: null } } } } },
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
                Cấu hình toàn hệ thống
              </span>
            </div>
            <h1>Giao diện &amp; Danh mục hệ thống</h1>
            <p className="settings-hero-copy">
              Tùy chỉnh phong cách giao diện cá nhân và quản lý danh mục phân loại dùng chung cho mọi workspace.
            </p>
          </div>
          <div className="settings-summary" aria-label="Tổng quan hệ thống">
            <span>
              <Palette size={14} className="inline mr-1 text-[var(--primary)]" />
              <strong>5</strong> Chủ đề màu
            </span>
            <span>
              <strong>{activeCategoryCount}</strong> / {categories.length} Danh mục hoạt động
            </span>
            <span className="settings-role settings-role-admin">
              <ShieldCheck size={14} className="inline mr-1 text-[var(--coral)]" />
              Khóa xác minh Admin
            </span>
          </div>
        </header>

        {/* Content sections */}
        <div className="settings-sections-grid mt-6 space-y-6">
          <GeneralSettingsClient />
          <GlobalCategoryManagement
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
              transactionCount: category._count.transactions,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

