import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/domain/legal-policy/policy-versions";
import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";

export type LegalConsentStatus = {
  satisfied: boolean;
  acceptedPrivacyVersion: string | null;
  acceptedTermsVersion: string | null;
};

export async function getLegalConsentStatus(
  userId: string,
): Promise<LegalConsentStatus> {
  const acceptance = await prisma.legalAcceptance.findUnique({
    where: {
      userId_privacyVersion_termsVersion: {
        userId,
        privacyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
      },
    },
    select: {
      privacyVersion: true,
      termsVersion: true,
    },
  });

  const satisfied = Boolean(acceptance);

  return {
    satisfied,
    acceptedPrivacyVersion: satisfied ? acceptance!.privacyVersion : null,
    acceptedTermsVersion: satisfied ? acceptance!.termsVersion : null,
  };
}

export async function acceptCurrentLegalDocuments(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "active", deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    throw new AppError("AUTHENTICATION_REQUIRED", "Phiên đăng nhập không còn hợp lệ.");
  }

  const documents = getCurrentLegalDocuments();
  return prisma.legalAcceptance.upsert({
    where: {
      userId_privacyVersion_termsVersion: {
        userId,
        privacyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
      },
    },
    create: {
      userId,
      privacyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      privacyContentHash: documents.privacy.contentHash,
      termsVersion: CURRENT_TERMS_VERSION,
      termsContentHash: documents.terms.contentHash,
    },
    update: {},
  });
}
