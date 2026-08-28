import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  legalAcceptance: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getCurrentLegalDocuments } from "@/domain/legal-policy/policy";
import {
  acceptCurrentLegalDocuments,
  getLegalConsentStatus,
} from "@/services/legal-consent-service";

describe("legal consent service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognizes the exact current version pair", async () => {
    const documents = getCurrentLegalDocuments();
    mockPrisma.legalAcceptance.findUnique.mockResolvedValue({
      privacyVersion: documents.privacy.version,
      termsVersion: documents.terms.version,
    });

    await expect(getLegalConsentStatus("user-1")).resolves.toEqual({
      satisfied: true,
      acceptedPrivacyVersion: documents.privacy.version,
      acceptedTermsVersion: documents.terms.version,
    });
    mockPrisma.legalAcceptance.findUnique.mockResolvedValue(null);
    await expect(getLegalConsentStatus("user-1")).resolves.toEqual({
      satisfied: false,
      acceptedPrivacyVersion: null,
      acceptedTermsVersion: null,
    });
  });

  it("upserts the current version pair so repeated submissions are idempotent", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    mockPrisma.legalAcceptance.upsert.mockResolvedValue({ id: "acceptance-1" });

    await acceptCurrentLegalDocuments("user-1");

    expect(mockPrisma.legalAcceptance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "user-1" }),
        update: {},
      }),
    );
  });

  it("rejects inactive or deleted users", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(acceptCurrentLegalDocuments("user-1")).rejects.toThrow(
      "Phiên đăng nhập không còn hợp lệ.",
    );
    expect(mockPrisma.legalAcceptance.upsert).not.toHaveBeenCalled();
  });
});
