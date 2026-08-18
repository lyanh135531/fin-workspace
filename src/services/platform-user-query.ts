import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PortalUserSearch } from "@/domain/platform-user/schemas";

export const PORTAL_USER_PAGE_SIZE = 20;

export const portalUserSelect = {
  id: true,
  username: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type PortalUserRecord = Prisma.UserGetPayload<{
  select: typeof portalUserSelect;
}>;

function buildPortalUserWhere(
  filters: Pick<PortalUserSearch, "q" | "status">,
): Prisma.UserWhereInput {
  return {
    ...(filters.q
      ? { username: { contains: filters.q, mode: "insensitive" } }
      : {}),
    ...(filters.status === "all" ? {} : { status: filters.status }),
  };
}

export async function listPortalUsers(filters: PortalUserSearch) {
  const where = buildPortalUserWhere(filters);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: portalUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * PORTAL_USER_PAGE_SIZE,
      take: PORTAL_USER_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page: filters.page,
    pageSize: PORTAL_USER_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PORTAL_USER_PAGE_SIZE)),
  };
}

export function getPortalUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: portalUserSelect,
  });
}
