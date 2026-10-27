import { redirect } from "next/navigation";

import { CategoryManagement } from "@/app/dashboard/settings/category-management";
import { PageContainer, PageHeader } from "@/components/base";
import { isAdminRole } from "@/domain/role-policy";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { manageableCategoryWhere } from "@/services/category-visibility";

export default async function CategoriesSettingsPage() {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
    },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/overview");

  const isAdmin = isAdminRole(membership.role.code);
  if (!isAdmin) redirect("/overview");

  const categories = await prisma.category.findMany({
    where: manageableCategoryWhere(workspaceId),
    include: {
      _count: { select: { transactions: { where: { deletedAt: null } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <PageContainer className="space-y-4 md:space-y-5">
      <PageHeader
        title="Danh mục thu chi"
        description="Quản lý danh mục cha, danh mục con và gán hũ tài chính cho các khoản chi tiêu."
        eyebrow="Cài đặt nhóm"
        border={false}
      />

      <CategoryManagement
        workspaceId={workspaceId}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          code: category.code,
          color: category.color,
          type: category.type,
          icon: category.icon,
          parentId: category.parentId,
          jarCode: category.jarCode,
          status: category.status,
          transactionCount: category._count.transactions,
        }))}
      />
    </PageContainer>
  );
}
