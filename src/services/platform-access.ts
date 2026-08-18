import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { isPlatformAdminUsername } from "@/domain/platform-user/schemas";

export async function requirePlatformAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.username) {
    redirect("/sign-in");
  }

  if (!isPlatformAdminUsername(session.user.username)) {
    notFound();
  }

  return session.user;
}
