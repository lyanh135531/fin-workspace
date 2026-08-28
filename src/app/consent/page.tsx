import type { Metadata } from "next";
import { getServerSession } from "next-auth";
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
      className="flex min-h-dvh flex-col justify-between bg-[var(--background)] px-4 py-4 sm:px-6 sm:py-8 lg:py-10"
      tabIndex={-1}
    >
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
        <FinLogo size={30} showText />
        <ThemeToggle />
      </header>

      <div className="my-auto flex w-full justify-center py-4 sm:py-6">
        <ConsentClient
          session={session}
          privacyVersion={documents.privacy.version}
          termsVersion={documents.terms.version}
          effectiveDate={documents.privacy.effectiveDate}
          callbackUrl={callbackUrl}
        />
      </div>

      <footer className="mx-auto w-full max-w-lg text-center text-xs text-[var(--text-muted)]">
        <p>Felix · Quản lý tài chính an toàn và minh bạch</p>
      </footer>
    </main>
  );
}

