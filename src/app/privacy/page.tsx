import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal-document-page";
import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật và xử lý dữ liệu cá nhân của Felix.",
};

export default function PrivacyPage() {
  const documents = getCurrentLegalDocuments();
  return (
    <LegalDocumentPage
      document={documents.privacy}
      contactEmail={documents.contactEmail}
    />
  );
}
