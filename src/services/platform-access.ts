import { notFound, redirect } from "next/navigation";

import { isPlatformAdminUsername } from "@/domain/platform-user/schemas";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";

export async function requirePlatformAdminSession() {
  const session = await requireAcceptedLegalPageSession();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (typeof prisma.user?.findUnique === "function") {
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, status: true, deletedAt: true },
    });
    if (
      !currentUser ||
      (currentUser.status !== undefined && currentUser.status !== "active") ||
      (currentUser.deletedAt !== undefined && currentUser.deletedAt !== null) ||
      !currentUser.username
    ) {
      redirect("/sign-in");
    }

    if (!isPlatformAdminUsername(currentUser.username)) {
      notFound();
    }

    return { ...session.user, username: currentUser.username };
  }

  const username = session.user.username;

  if (!username) {
    redirect("/sign-in");
  }

  if (!isPlatformAdminUsername(username)) {
    notFound();
  }

  return { ...session.user, username };
}
