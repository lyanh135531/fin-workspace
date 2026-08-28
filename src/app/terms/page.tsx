import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal-document-page";
import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: "Điều khoản áp dụng khi sử dụng Felix.",
};

export default function TermsPage() {
  const documents = getCurrentLegalDocuments();
  return (
    <LegalDocumentPage
      document={documents.terms}
      contactEmail={documents.contactEmail}
    />
  );
}
