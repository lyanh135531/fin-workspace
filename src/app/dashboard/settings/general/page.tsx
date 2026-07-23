import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container">
        <header className="settings-hero">
          <div>
            <p className="settings-eyebrow">Cài đặt chung</p>
            <h1>Hệ thống &amp; giao diện</h1>
            <p className="settings-hero-copy">Giao diện hiển thị và danh mục dùng chung cho toàn bộ workspace.</p>
          </div>
        </header>
        <GlobalCategoryManagement
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            code: category.code,
            color: category.color,
            type: category.type,
            icon: category.icon,
            parentId: category.parentId,
            status: category.status,
            transactionCount: category._count.transactions,
          }))}
        />
        <GeneralSettingsClient />
      </div>
    </div>
  );
}
