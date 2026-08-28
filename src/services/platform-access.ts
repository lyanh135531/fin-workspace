import { notFound, redirect } from "next/navigation";

import { isPlatformAdminUsername } from "@/domain/platform-user/schemas";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";

export async function requirePlatformAdminSession() {
  const session = await requireAcceptedLegalPageSession();

  if (!session?.user?.id || !session.user.username) {
    redirect("/sign-in");
  }

  if (!isPlatformAdminUsername(session.user.username)) {
    notFound();
  }

  return { ...session.user, username: session.user.username };
}
