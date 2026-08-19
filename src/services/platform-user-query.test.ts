import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  getPortalUserById,
  listPortalUsers,
  portalUserSelect,
} from "@/services/platform-user-query";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("platform user read-only queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a fixed safe select and server-side pagination", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(24);
    prisma.$queryRaw = vi.fn().mockResolvedValue([]);

    const result = await listPortalUsers({
      q: "felix",
      page: 2,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        username: { contains: "felix", mode: "insensitive" },
      },
      select: portalUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: 20,
      take: 20,
    });
    expect(result).toEqual({
      users: [],
      total: 24,
      page: 2,
      pageSize: 20,
      totalPages: 2,
    });
    expect(portalUserSelect).not.toHaveProperty("passwordHash");
    expect(portalUserSelect).not.toHaveProperty("memberships");
  });

  it("fetches user details without loading relations", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await getPortalUserById("user-id");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-id" },
      select: portalUserSelect,
    });
  });
});
