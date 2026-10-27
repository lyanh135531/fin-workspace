import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  legalAcceptance: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
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
    mockPrisma.user.findUnique.mockResolvedValue({
      status: "active",
      deletedAt: null,
      profileCompletedAt: new Date(),
    });
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

  it("throws AUTHENTICATION_REQUIRED when user is missing, inactive, or deleted", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(getLegalConsentStatus("user-missing")).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      status: "inactive",
      deletedAt: null,
      profileCompletedAt: new Date(),
    });
    await expect(getLegalConsentStatus("user-inactive")).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      status: "active",
      deletedAt: new Date(),
      profileCompletedAt: new Date(),
    });
    await expect(getLegalConsentStatus("user-deleted")).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("throws FORBIDDEN only when Google profile setup is incomplete", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      status: "active",
      deletedAt: null,
      profileCompletedAt: null,
    });
    await expect(getLegalConsentStatus("user-incomplete")).rejects.toMatchObject({
      code: "FORBIDDEN",
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
