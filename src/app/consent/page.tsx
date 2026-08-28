import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { redirect } from "next/navigation";

import { ConsentClient } from "@/app/consent/consent-client";
import { ThemeToggle } from "@/app/theme-toggle";
import { authOptions } from "@/auth";
import { FinLogo } from "@/components/fin-logo";
import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";

export const metadata: Metadata = {
  title: "Xác nhận chính sách",
  robots: { index: false, follow: false },
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  if (!session.user.profileCompleted) redirect("/setup/google");

  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;
  const documents = getCurrentLegalDocuments();

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[var(--background)] px-4 py-5 text-[var(--foreground)] sm:px-6 sm:py-8 lg:py-12"
      tabIndex={-1}
    >
      <div className="mx-auto mb-6 flex w-full max-w-2xl items-center justify-between">
        <FinLogo size={32} showText />
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-2xl items-start justify-center">
        <SessionProvider session={session}>
          <ConsentClient
            privacyVersion={documents.privacy.version}
            termsVersion={documents.terms.version}
            effectiveDate={documents.privacy.effectiveDate}
            callbackUrl={callbackUrl}
          />
        </SessionProvider>
      </div>
    </main>
  );
}
