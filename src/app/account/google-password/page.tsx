import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { GooglePasswordClient } from "@/app/account/google-password/password-client";
import { getAccountSecurityState } from "@/services/google-auth-service";

export default async function GooglePasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const state = await getAccountSecurityState(session.user.id);
  if (state.hasPassword || !state.googleAccount) redirect("/overview");
  return <GooglePasswordClient />;
}
