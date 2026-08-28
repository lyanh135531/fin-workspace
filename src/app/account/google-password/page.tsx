import { redirect } from "next/navigation";

import { GooglePasswordClient } from "@/app/account/google-password/password-client";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { getAccountSecurityState } from "@/services/google-auth-service";

export default async function GooglePasswordPage() {
  const session = await requireAcceptedLegalPageSession();
  const state = await getAccountSecurityState(session.user.id);
  if (state.hasPassword || !state.googleAccount) redirect("/overview");
  return <GooglePasswordClient />;
}
