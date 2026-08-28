import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal-document-page";
import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";
import { getLegalDocumentReturnPath } from "@/lib/host-routing";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: "Điều khoản áp dụng khi sử dụng Felix.",
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;
  const documents = getCurrentLegalDocuments();
  return (
    <LegalDocumentPage
      document={documents.terms}
      contactEmail={documents.contactEmail}
      returnHref={getLegalDocumentReturnPath(callbackUrl)}
    />
  );
}
