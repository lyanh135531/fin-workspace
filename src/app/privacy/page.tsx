import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal-document-page";
import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";
import { getLegalDocumentReturnPath } from "@/lib/host-routing";

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật và xử lý dữ liệu cá nhân của Felix.",
};

export default async function PrivacyPage({
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
      document={documents.privacy}
      contactEmail={documents.contactEmail}
      returnHref={getLegalDocumentReturnPath(callbackUrl)}
    />
  );
}
