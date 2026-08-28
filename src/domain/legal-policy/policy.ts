import { createHash } from "node:crypto";

import privacySource from "@/content/legal/privacy.json";
import termsSource from "@/content/legal/terms.json";
import {
  CURRENT_LEGAL_EFFECTIVE_DATE,
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/domain/legal-policy/policy-versions";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  summary: string;
  version: string;
  effectiveDate: string;
  contentHash: string;
  sections: LegalSection[];
};

type OperatorDetails = {
  operatorName: string;
  operatorAddress: string;
  contactEmail: string;
  infrastructureProviders: string;
  dataStorageLocation: string;
  dataRetentionSummary: string;
};

const developmentFallbacks: OperatorDetails = {
  operatorName: "Felix (chưa cấu hình tên pháp lý)",
  operatorAddress: "Chưa cấu hình địa chỉ liên hệ",
  contactEmail: "privacy@example.com",
  infrastructureProviders: "Chưa cấu hình nhà cung cấp hạ tầng",
  dataStorageLocation: "Chưa cấu hình khu vực lưu trữ dữ liệu",
  dataRetentionSummary: "Chưa cấu hình chính sách lưu giữ dữ liệu",
};

function getOperatorDetails(): OperatorDetails {
  const configured: Partial<OperatorDetails> = {
    operatorName: process.env.LEGAL_OPERATOR_NAME,
    operatorAddress: process.env.LEGAL_OPERATOR_ADDRESS,
    contactEmail: process.env.LEGAL_CONTACT_EMAIL,
    infrastructureProviders: process.env.LEGAL_INFRASTRUCTURE_PROVIDERS,
    dataStorageLocation: process.env.LEGAL_DATA_STORAGE_LOCATION,
    dataRetentionSummary: process.env.LEGAL_DATA_RETENTION_SUMMARY,
  };

  const missing = Object.entries(configured)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);
  if (process.env.LEGAL_CONSENT_ENFORCED === "true" && missing.length > 0) {
    throw new Error(
      `Legal consent cannot be enforced until these settings are configured: ${missing.join(", ")}`,
    );
  }

  return {
    operatorName: configured.operatorName?.trim() ?? developmentFallbacks.operatorName,
    operatorAddress:
      configured.operatorAddress?.trim() ?? developmentFallbacks.operatorAddress,
    contactEmail: configured.contactEmail?.trim() ?? developmentFallbacks.contactEmail,
    infrastructureProviders:
      configured.infrastructureProviders?.trim() ??
      developmentFallbacks.infrastructureProviders,
    dataStorageLocation:
      configured.dataStorageLocation?.trim() ?? developmentFallbacks.dataStorageLocation,
    dataRetentionSummary:
      configured.dataRetentionSummary?.trim() ??
      developmentFallbacks.dataRetentionSummary,
  };
}

function replacePlaceholders(value: string, details: OperatorDetails) {
  return value
    .replaceAll("{{OPERATOR_NAME}}", details.operatorName)
    .replaceAll("{{OPERATOR_ADDRESS}}", details.operatorAddress)
    .replaceAll("{{CONTACT_EMAIL}}", details.contactEmail)
    .replaceAll("{{INFRASTRUCTURE_PROVIDERS}}", details.infrastructureProviders)
    .replaceAll("{{DATA_STORAGE_LOCATION}}", details.dataStorageLocation)
    .replaceAll("{{DATA_RETENTION_SUMMARY}}", details.dataRetentionSummary);
}

function renderDocument(
  source: Omit<LegalDocument, "version" | "effectiveDate" | "contentHash">,
  version: string,
  details: OperatorDetails,
): LegalDocument {
  const rendered = {
    title: source.title,
    summary: replacePlaceholders(source.summary, details),
    version,
    effectiveDate: CURRENT_LEGAL_EFFECTIVE_DATE,
    sections: source.sections.map((section) => ({
      title: replacePlaceholders(section.title, details),
      paragraphs: section.paragraphs?.map((item) =>
        replacePlaceholders(item, details),
      ),
      bullets: section.bullets?.map((item) => replacePlaceholders(item, details)),
    })),
  };

  return {
    ...rendered,
    contentHash: createHash("sha256")
      .update(JSON.stringify(rendered))
      .digest("hex"),
  };
}

export function getCurrentLegalDocuments() {
  const details = getOperatorDetails();
  return {
    privacy: renderDocument(
      privacySource,
      CURRENT_PRIVACY_POLICY_VERSION,
      details,
    ),
    terms: renderDocument(termsSource, CURRENT_TERMS_VERSION, details),
    contactEmail: details.contactEmail,
  };
}
