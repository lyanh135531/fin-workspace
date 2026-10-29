import crypto from "node:crypto";
import Decimal from "decimal.js";
import {
  commitQuickCaptureSchema,
  createQuickCaptureTokenSchema,
  createTransactionSchema,
  isQuickCaptureCancelOption,
  isQuickCaptureSoftDismissOption,
  normalizePayeeKey,
  parsePaymentReceiptText,
  parseReceiptInputSchema,
  revokeQuickCaptureTokenSchema,
  type PaymentProviderCode,
  type ReceiptRejectionReason,
} from "@/domain";
import { getBusinessDateInTimeZone, shiftIsoDate } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { createTransaction } from "@/services/transaction-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

const TOKEN_PREFIX_TAG = "flx_qc_";
const DRAFT_TTL_MS = 10 * 60 * 1000;
const EXPIRED_DRAFT_CLEANUP_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_TOKENS_PER_WORKSPACE = 10;
const MAX_RECEIPT_AGE_DAYS = 366;

export const QUICK_CAPTURE_CANCEL_OPTION = "Bỏ qua giao dịch";
const SUGGESTED_OPTION_SUFFIX = " · Gợi ý";
const LEGACY_SUGGESTED_PREFIX = "⭐ ";
const LEGACY_SUGGESTED_SUFFIX = " (Gợi ý)";

const PROVIDER_LABELS: Record<PaymentProviderCode, string> = {
  momo: "Ví MoMo",
  vcb: "Vietcombank",
  tcb: "Techcombank",
  mb: "MB Bank",
  acb: "ACB",
  bidv: "BIDV",
  icb: "VietinBank",
  vpb: "VPBank",
  tpb: "TPBank",
  zalopay: "ZaloPay",
  shopeepay: "ShopeePay",
};

const PROVIDER_SHORT_TAGS: Record<PaymentProviderCode, string> = {
  momo: "MoMo",
  vcb: "VCB",
  tcb: "TCB",
  mb: "MB",
  acb: "ACB",
  bidv: "BIDV",
  icb: "VietinBank",
  vpb: "VPBank",
  tpb: "TPBank",
  zalopay: "ZaloPay",
  shopeepay: "ShopeePay",
};

const PROVIDER_WALLET_MATCHERS: Record<PaymentProviderCode, RegExp> = {
  momo: /\bmomo\b/i,
  vcb: /\b(?:vietcombank|vcb)\b/i,
  tcb: /\b(?:techcombank|tcb)\b/i,
  mb: /\b(?:mbbank|mb\s*bank|mb)\b/i,
  acb: /\bacb\b/i,
  bidv: /\bbidv\b/i,
  icb: /\b(?:vietinbank|icb)\b/i,
  vpb: /\bvpbank\b/i,
  tpb: /\btpbank\b/i,
  zalopay: /\bzalopay\b/i,
  shopeepay: /\bshopeepay\b/i,
};

export type QuickCaptureActor = {
  userId: string;
  workspaceId: string;
  timeZone: string;
  defaultWalletId: string | null;
  defaultCategoryId: string | null;
  tokenId: string | null;
};

export type QuickCaptureSettingsState =
  | {
      available: false;
    }
  | {
      available: true;
      workspaceId: string;
      workspaceName: string;
      wallets: Array<{
        id: string;
        name: string;
        assetSubtype: string | null;
      }>;
      categories: Array<{
        id: string;
        name: string;
        color: string;
      }>;
      tokens: Array<{
        id: string;
        name: string;
        tokenPrefix: string;
        defaultWalletId: string;
        defaultWalletName: string;
        defaultCategoryId: string | null;
        defaultCategoryName: string | null;
        expiresAt: string;
        lastUsedAt: string | null;
        createdAt: string;
      }>;
    };

export function hashQuickCaptureToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function formatServerVnd(amount: Decimal): string {
  const rounded = amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
  const grouped = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped}đ`;
}

function cleanSelectedOptionLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw.normalize("NFC").trim();
  if (cleaned.startsWith(LEGACY_SUGGESTED_PREFIX)) {
    cleaned = cleaned.slice(LEGACY_SUGGESTED_PREFIX.length).trim();
  }
  if (cleaned.endsWith(SUGGESTED_OPTION_SUFFIX)) {
    cleaned = cleaned.slice(0, -SUGGESTED_OPTION_SUFFIX.length).trim();
  } else if (cleaned.endsWith(LEGACY_SUGGESTED_SUFFIX)) {
    cleaned = cleaned.slice(0, -LEGACY_SUGGESTED_SUFFIX.length).trim();
  }
  return cleaned || null;
}

async function listActiveWorkspaceAssetWallets(workspaceId: string) {
  const links = await prisma.workspaceWallet.findMany({
    where: {
      workspaceId,
      wallet: {
        kind: "asset",
        status: "active",
        deletedAt: null,
      },
    },
    include: {
      wallet: {
        select: {
          id: true,
          name: true,
          assetSubtype: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { wallet: { createdAt: "asc" } }],
  });

  return links.map((link) => link.wallet);
}

async function listActiveWorkspaceExpenseCategories(workspaceId: string) {
  return prisma.category.findMany({
    where: {
      workspaceId,
      type: "expense",
      status: "active",
      deletedAt: null,
      jarCode: { not: null },
    },
    select: {
      id: true,
      name: true,
      color: true,
      jarCode: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

function selectSmartWallet(
  wallets: Array<{ id: string; name: string }>,
  provider: PaymentProviderCode | null,
  preferredWalletId: string | null | undefined,
) {
  if (wallets.length === 0) {
    throw new AppError(
      "INACTIVE_RESOURCE",
      "Nhóm tài chính chưa có ví thanh toán khả dụng để ghi giao dịch.",
    );
  }

  if (preferredWalletId) {
    const explicit = wallets.find((w) => w.id === preferredWalletId);
    if (explicit && !provider) return explicit;
    if (provider) {
      const matcher = PROVIDER_WALLET_MATCHERS[provider];
      const providerMatch = wallets.find((w) => matcher.test(w.name));
      if (providerMatch) return providerMatch;
    }
    if (explicit) return explicit;
  } else if (provider) {
    const matcher = PROVIDER_WALLET_MATCHERS[provider];
    const providerMatch = wallets.find((w) => matcher.test(w.name));
    if (providerMatch) return providerMatch;
  }

  return wallets[0]!;
}

export async function authenticateQuickCaptureBearer(
  authHeader: string | null,
  now = new Date(),
): Promise<QuickCaptureActor> {
  if (!authHeader || !authHeader.trim()) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Thiếu khóa kết nối thiết bị.",
    );
  }

  const rawToken = authHeader.replace(/^(?:Bearer\s+)+/i, "").trim();
  if (
    !rawToken.startsWith(TOKEN_PREFIX_TAG) ||
    rawToken.length < 24 ||
    rawToken.length > 128
  ) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Khóa kết nối không hợp lệ hoặc đã hết hạn.",
    );
  }

  const tokenHash = hashQuickCaptureToken(rawToken);
  const record = await prisma.quickCaptureToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, status: true, deletedAt: true } },
      workspace: {
        select: { id: true, status: true, deletedAt: true, timeZone: true },
      },
    },
  });

  if (
    !record ||
    record.revokedAt !== null ||
    record.expiresAt <= now ||
    record.user.status !== "active" ||
    record.user.deletedAt !== null ||
    record.workspace.status !== "active" ||
    record.workspace.deletedAt !== null
  ) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Khóa kết nối không hợp lệ, đã bị thu hồi hoặc đã hết hạn.",
    );
  }

  const member = await requireWorkspaceMember(record.userId, record.workspaceId);

  await prisma.quickCaptureToken
    .update({
      where: { id: record.id },
      data: { lastUsedAt: now },
    })
    .catch(() => null);

  return {
    userId: record.userId,
    workspaceId: record.workspaceId,
    timeZone: member.workspace.timeZone,
    defaultWalletId: record.defaultWalletId,
    defaultCategoryId: record.defaultCategoryId,
    tokenId: record.id,
  };
}

export async function getQuickCaptureSettingsState(
  userId: string,
  now = new Date(),
): Promise<QuickCaptureSettingsState> {
  const workspaceId = await resolveActiveWorkspaceId(userId);
  if (!workspaceId) {
    return { available: false };
  }

  const member = await requireWorkspaceMember(userId, workspaceId);

  const [wallets, categories, tokens] = await Promise.all([
    listActiveWorkspaceAssetWallets(workspaceId),
    listActiveWorkspaceExpenseCategories(workspaceId),
    prisma.quickCaptureToken.findMany({
      where: {
        userId,
        workspaceId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        defaultWallet: { select: { name: true } },
        defaultCategory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    available: true,
    workspaceId,
    workspaceName: member.workspace.name,
    wallets: wallets.map((w) => ({
      id: w.id,
      name: w.name,
      assetSubtype: w.assetSubtype,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      defaultWalletId: t.defaultWalletId,
      defaultWalletName: t.defaultWallet.name,
      defaultCategoryId: t.defaultCategoryId,
      defaultCategoryName: t.defaultCategory?.name ?? null,
      expiresAt: t.expiresAt.toISOString(),
      lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function createQuickCaptureToken(
  userId: string,
  rawInput: unknown,
  now = new Date(),
) {
  const input = createQuickCaptureTokenSchema.parse(rawInput);
  await requireWorkspaceMember(userId, input.workspaceId);

  const activeCount = await prisma.quickCaptureToken.count({
    where: {
      userId,
      workspaceId: input.workspaceId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (activeCount >= MAX_ACTIVE_TOKENS_PER_WORKSPACE) {
    throw new AppError(
      "CONFLICT",
      "Bạn đã đạt giới hạn 10 thiết bị đang kết nối. Vui lòng thu hồi thiết bị cũ trước.",
    );
  }

  const walletLink = await prisma.workspaceWallet.findFirst({
    where: {
      workspaceId: input.workspaceId,
      walletId: input.defaultWalletId,
      wallet: {
        kind: "asset",
        status: "active",
        deletedAt: null,
      },
    },
    include: {
      wallet: { select: { id: true, name: true } },
    },
  });
  if (!walletLink) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Ví mặc định không hợp lệ hoặc không thuộc nhóm tài chính này.",
    );
  }

  if (input.defaultCategoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: input.defaultCategoryId,
        workspaceId: input.workspaceId,
        type: "expense",
        status: "active",
        deletedAt: null,
        jarCode: { not: null },
      },
      select: { id: true },
    });
    if (!category) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Danh mục dự phòng không hợp lệ hoặc chưa gắn hũ chi tiêu.",
      );
    }
  }

  const rawToken = `${TOKEN_PREFIX_TAG}${crypto.randomBytes(24).toString("base64url")}`;
  const tokenPrefix = rawToken.slice(0, 14);
  const tokenHash = hashQuickCaptureToken(rawToken);
  const expiresAt = new Date(
    now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000,
  );

  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.quickCaptureToken.create({
      data: {
        userId,
        workspaceId: input.workspaceId,
        defaultWalletId: input.defaultWalletId,
        defaultCategoryId: input.defaultCategoryId ?? null,
        name: input.name,
        tokenPrefix,
        tokenHash,
        expiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: userId,
        action: "quick_capture.token_created",
        entityType: "quick_capture_token",
        entityId: record.id,
        metadata: {
          name: record.name,
          tokenPrefix: record.tokenPrefix,
          expiresInDays: input.expiresInDays,
        },
      },
    });

    return record;
  });

  return {
    token: rawToken,
    tokenInfo: {
      id: created.id,
      name: created.name,
      tokenPrefix: created.tokenPrefix,
      defaultWalletName: walletLink.wallet.name,
      expiresAt: created.expiresAt.toISOString(),
    },
  };
}

export async function revokeQuickCaptureToken(
  userId: string,
  rawInput: unknown,
  now = new Date(),
) {
  const input = revokeQuickCaptureTokenSchema.parse(rawInput);

  const existing = await prisma.quickCaptureToken.findFirst({
    where: {
      id: input.tokenId,
      userId,
      revokedAt: null,
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      tokenPrefix: true,
    },
  });

  if (!existing) {
    throw new AppError(
      "NOT_FOUND",
      "Không tìm thấy thiết bị đang kết nối để thu hồi.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.quickCaptureToken.update({
      where: { id: existing.id },
      data: { revokedAt: now },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: existing.workspaceId,
        actorUserId: userId,
        action: "quick_capture.token_revoked",
        entityType: "quick_capture_token",
        entityId: existing.id,
        metadata: {
          name: existing.name,
          tokenPrefix: existing.tokenPrefix,
        },
      },
    });
  });

  return { revoked: true as const };
}

function getMissingAmountMessage(
  reason: ReceiptRejectionReason | null | undefined,
): string {
  if (reason === "incoming_credit") {
    return "Đây là giao dịch nhận tiền vào ví, không phải khoản chi tiêu.";
  }
  if (reason === "promotional") {
    return "Thông báo ưu đãi đã được tự động bỏ qua.";
  }
  return "Chưa nhận diện được số tiền thanh toán trên màn hình này.";
}

function resolveReceiptBusinessDate(
  candidateIsoDate: string | null | undefined,
  todayIsoDate: string,
): string {
  if (!candidateIsoDate || !/^\d{4}-\d{2}-\d{2}$/.test(candidateIsoDate)) {
    return todayIsoDate;
  }
  const oldestAllowed = shiftIsoDate(todayIsoDate, -MAX_RECEIPT_AGE_DAYS);
  if (candidateIsoDate > todayIsoDate || candidateIsoDate < oldestAllowed) {
    return todayIsoDate;
  }
  return candidateIsoDate;
}

function formatShortReceiptDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export async function prepareQuickCapture(
  actor: QuickCaptureActor,
  rawInput: unknown,
  now = new Date(),
) {
  const input = parseReceiptInputSchema.parse(rawInput);
  const parsed = parsePaymentReceiptText(input.text);

  const amount = input.amount ?? parsed.amount;
  if (!amount || amount.lte(0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      getMissingAmountMessage(parsed.rejectedReason),
    );
  }

  const today = getBusinessDateInTimeZone(actor.timeZone, now);
  const transactionDate = resolveReceiptBusinessDate(
    input.date ?? parsed.transactionDate,
    today,
  );

  const payeeName = input.payeeName ?? parsed.payeeName;
  const payeeKey = normalizePayeeKey(payeeName);

  // Opportunistically clean up abandoned uncommitted drafts older than 24h
  void prisma.quickCaptureDraft
    .deleteMany({
      where: {
        userId: actor.userId,
        committedTransactionId: null,
        expiresAt: { lt: new Date(now.getTime() - EXPIRED_DRAFT_CLEANUP_MS) },
      },
    })
    .catch(() => null);

  if (parsed.externalRef) {
    const duplicate = await prisma.quickCaptureDraft.findFirst({
      where: {
        workspaceId: actor.workspaceId,
        externalRef: parsed.externalRef,
        committedTransaction: {
          deletedAt: null,
          workflowStatus: { not: "rejected" },
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        "Biên lai giao dịch này đã được ghi vào sổ trước đó.",
      );
    }
  }

  const [wallets, categories, learnedRule] = await Promise.all([
    listActiveWorkspaceAssetWallets(actor.workspaceId),
    listActiveWorkspaceExpenseCategories(actor.workspaceId),
    payeeKey
      ? prisma.quickCapturePayeeRule.findUnique({
          where: {
            workspaceId_payeeKey: {
              workspaceId: actor.workspaceId,
              payeeKey,
            },
          },
          select: { categoryId: true },
        })
      : Promise.resolve(null),
  ]);

  if (categories.length === 0) {
    throw new AppError(
      "INACTIVE_RESOURCE",
      "Nhóm tài chính chưa có danh mục chi tiêu khả dụng.",
    );
  }

  const targetWallet = selectSmartWallet(
    wallets,
    parsed.provider,
    actor.defaultWalletId,
  );

  const suggestedCategory =
    (learnedRule
      ? categories.find((c) => c.id === learnedRule.categoryId)
      : undefined) ??
    (actor.defaultCategoryId
      ? categories.find((c) => c.id === actor.defaultCategoryId)
      : undefined) ??
    null;

  const expiresAt = new Date(now.getTime() + DRAFT_TTL_MS);

  const draft = await prisma.quickCaptureDraft.create({
    data: {
      tokenId: actor.tokenId,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      walletId: targetWallet.id,
      suggestedCategoryId: suggestedCategory?.id ?? null,
      amount,
      payeeName: payeeName ? payeeName.slice(0, 200) : null,
      payeeKey,
      note: parsed.note ? parsed.note.slice(0, 500) : null,
      provider: parsed.provider,
      externalRef: parsed.externalRef,
      transactionDate,
      expiresAt,
    },
  });

  const options: string[] = [];
  if (suggestedCategory) {
    options.push(`${suggestedCategory.name}${SUGGESTED_OPTION_SUFFIX}`);
  }
  for (const cat of categories) {
    if (suggestedCategory && cat.id === suggestedCategory.id) continue;
    options.push(cat.name);
  }
  options.push(QUICK_CAPTURE_CANCEL_OPTION);

  const formattedAmount = formatServerVnd(amount);
  const dateBadge =
    transactionDate !== today
      ? ` · ${formatShortReceiptDate(transactionDate)}`
      : "";
  const headlineTarget = payeeName ? ` · ${payeeName}` : "";
  const prompt = `-${formattedAmount}${dateBadge}${headlineTarget} (${targetWallet.name})`;

  return {
    draftId: draft.id,
    prompt,
    options,
    parsed: {
      amount: amount.toFixed(0),
      formattedAmount,
      transactionDate,
      payeeName,
      note: parsed.note,
      provider: parsed.provider,
      providerLabel: parsed.provider ? PROVIDER_LABELS[parsed.provider] : null,
      externalRef: parsed.externalRef,
    },
    wallet: {
      id: targetWallet.id,
      name: targetWallet.name,
    },
    suggestedCategory: suggestedCategory
      ? {
          id: suggestedCategory.id,
          name: suggestedCategory.name,
        }
      : null,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    expiresAt: expiresAt.toISOString(),
  };
}

function buildLedgerDescription(params: {
  provider: PaymentProviderCode | null;
  payeeName: string | null;
  note: string | null;
}): string {
  const providerTag = params.provider
    ? PROVIDER_SHORT_TAGS[params.provider]
    : null;
  const details = [params.payeeName, params.note].filter(Boolean).join(" - ");

  if (providerTag && details) {
    return `[${providerTag}] ${details}`.slice(0, 500);
  }
  if (details) {
    return details.slice(0, 500);
  }
  if (providerTag) {
    return `Thanh toán qua ${providerTag}`;
  }
  return "Ghi nhanh từ biên lai";
}

export async function commitQuickCapture(
  actor: QuickCaptureActor,
  rawInput: unknown,
  now = new Date(),
) {
  const input = commitQuickCaptureSchema.parse(rawInput);

  if (isQuickCaptureCancelOption(input.selectedOption)) {
    const isSoftErrorDismiss = isQuickCaptureSoftDismissOption(
      input.selectedOption,
    );

    if (input.draftId) {
      await prisma.quickCaptureDraft.updateMany({
        where: {
          id: input.draftId,
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
    } else if (!isSoftErrorDismiss) {
      const latestOpenDraft = await prisma.quickCaptureDraft.findFirst({
        where: {
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          ...(actor.tokenId ? { tokenId: actor.tokenId } : {}),
          committedTransactionId: null,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      if (latestOpenDraft) {
        await prisma.quickCaptureDraft.updateMany({
          where: {
            id: latestOpenDraft.id,
            userId: actor.userId,
            workspaceId: actor.workspaceId,
            consumedAt: null,
          },
          data: { consumedAt: now },
        });
      }
    }
    return {
      cancelled: true as const,
      message: "Đã bỏ qua giao dịch.",
    };
  }

  let amount: Decimal | null = null;
  let payeeName: string | null = null;
  let payeeKey: string | null = null;
  let note: string | null = null;
  let provider: PaymentProviderCode | null = null;
  let externalRef: string | null = null;
  let candidateTransactionDate: string | null = null;
  let rejectedReason: ReceiptRejectionReason | null = null;
  let draftWalletId: string | null = null;
  let draftSuggestedCategoryId: string | null = null;
  let claimedDraftId: string | null = null;

  if (input.draftId || (!input.text && !input.amount)) {
    const draft = input.draftId
      ? await prisma.quickCaptureDraft.findFirst({
          where: {
            id: input.draftId,
            userId: actor.userId,
            workspaceId: actor.workspaceId,
          },
        })
      : await prisma.quickCaptureDraft.findFirst({
          where: {
            userId: actor.userId,
            workspaceId: actor.workspaceId,
            ...(actor.tokenId ? { tokenId: actor.tokenId } : {}),
            committedTransactionId: null,
            consumedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });

    if (!draft) {
      throw new AppError(
        "NOT_FOUND",
        input.draftId
          ? "Không tìm thấy phiên giao dịch cần lưu."
          : "Phiên chọn danh mục đã hết hạn hoặc không tồn tại. Vui lòng thực hiện lại trên biên lai.",
      );
    }
    if (draft.committedTransactionId || draft.consumedAt) {
      throw new AppError(
        "CONFLICT",
        "Giao dịch này đã được xử lý trước đó.",
      );
    }
    if (draft.expiresAt <= now) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Phiên chọn danh mục đã hết hạn. Vui lòng thực hiện lại trên biên lai.",
      );
    }

    const claimed = await prisma.quickCaptureDraft.updateMany({
      where: {
        id: draft.id,
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        consumedAt: null,
      },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        "CONFLICT",
        "Giao dịch này đang được xử lý ở yêu cầu khác.",
      );
    }

    claimedDraftId = draft.id;
    amount = input.amount ?? new Decimal(draft.amount.toString());
    payeeName = input.payeeName ?? draft.payeeName;
    payeeKey = normalizePayeeKey(payeeName) ?? draft.payeeKey;
    note = input.note ?? draft.note;
    provider = (draft.provider as PaymentProviderCode | null) ?? null;
    externalRef = input.externalRef ?? draft.externalRef;
    candidateTransactionDate = input.date ?? draft.transactionDate ?? null;
    draftWalletId = draft.walletId;
    draftSuggestedCategoryId = draft.suggestedCategoryId;
  } else {
    const parsed = input.text ? parsePaymentReceiptText(input.text) : null;
    amount = input.amount ?? parsed?.amount ?? null;
    payeeName = input.payeeName ?? parsed?.payeeName ?? null;
    payeeKey = normalizePayeeKey(payeeName);
    note = input.note ?? parsed?.note ?? null;
    provider = parsed?.provider ?? null;
    externalRef = input.externalRef ?? parsed?.externalRef ?? null;
    candidateTransactionDate = input.date ?? parsed?.transactionDate ?? null;
    rejectedReason = parsed?.rejectedReason ?? null;
  }

  try {
    if (!amount || amount.lte(0)) {
      throw new AppError(
        "VALIDATION_ERROR",
        rejectedReason
          ? getMissingAmountMessage(rejectedReason)
          : "Chưa nhận diện được số tiền hợp lệ để lưu giao dịch.",
      );
    }

    if (externalRef) {
      const duplicate = await prisma.quickCaptureDraft.findFirst({
        where: {
          workspaceId: actor.workspaceId,
          externalRef,
          committedTransaction: {
            deletedAt: null,
            workflowStatus: { not: "rejected" },
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(
          "CONFLICT",
          "Biên lai giao dịch này đã được ghi vào sổ trước đó.",
        );
      }
    }

    const [wallets, categories, learnedRule] = await Promise.all([
      listActiveWorkspaceAssetWallets(actor.workspaceId),
      listActiveWorkspaceExpenseCategories(actor.workspaceId),
      payeeKey
        ? prisma.quickCapturePayeeRule.findUnique({
            where: {
              workspaceId_payeeKey: {
                workspaceId: actor.workspaceId,
                payeeKey,
              },
            },
            select: { categoryId: true },
          })
        : Promise.resolve(null),
    ]);

    if (categories.length === 0) {
      throw new AppError(
        "INACTIVE_RESOURCE",
        "Nhóm tài chính chưa có danh mục chi tiêu khả dụng.",
      );
    }

    const cleanedOption = cleanSelectedOptionLabel(input.selectedOption);
    let selectedCategory = input.categoryId
      ? categories.find((c) => c.id === input.categoryId)
      : undefined;

    if (!selectedCategory && cleanedOption) {
      const targetLower = cleanedOption.toLocaleLowerCase("vi");
      selectedCategory = categories.find(
        (c) => c.name.normalize("NFC").toLocaleLowerCase("vi") === targetLower,
      );
      if (!selectedCategory) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Không tìm thấy danh mục "${cleanedOption}" trong nhóm tài chính.`,
        );
      }
    }

    if (!selectedCategory && draftSuggestedCategoryId) {
      selectedCategory = categories.find(
        (c) => c.id === draftSuggestedCategoryId,
      );
    }
    if (!selectedCategory && learnedRule) {
      selectedCategory = categories.find((c) => c.id === learnedRule.categoryId);
    }
    if (!selectedCategory && actor.defaultCategoryId) {
      selectedCategory = categories.find(
        (c) => c.id === actor.defaultCategoryId,
      );
    }
    if (!selectedCategory) {
      selectedCategory = categories[0];
    }

    if (!selectedCategory) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng chọn danh mục chi tiêu hợp lệ.",
      );
    }

    const targetWallet = selectSmartWallet(
      wallets,
      provider,
      input.walletId ?? draftWalletId ?? actor.defaultWalletId,
    );

    const today = getBusinessDateInTimeZone(actor.timeZone, now);
    const transactionDate = resolveReceiptBusinessDate(
      candidateTransactionDate,
      today,
    );
    const description = buildLedgerDescription({
      provider,
      payeeName,
      note,
    });

    const txInput = createTransactionSchema.parse({
      walletId: targetWallet.id,
      categoryId: selectedCategory.id,
      type: "expense",
      amount: amount.toFixed(4),
      description,
      date: transactionDate,
    });

    const transaction = await createTransaction(
      actor.userId,
      actor.workspaceId,
      txInput,
      now,
    );

    if (claimedDraftId) {
      await prisma.quickCaptureDraft.update({
        where: { id: claimedDraftId },
        data: {
          walletId: targetWallet.id,
          transactionDate,
          committedTransactionId: transaction.id,
          consumedAt: now,
        },
      });
    } else {
      await prisma.quickCaptureDraft.create({
        data: {
          tokenId: actor.tokenId,
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          walletId: targetWallet.id,
          suggestedCategoryId: selectedCategory.id,
          amount,
          payeeName: payeeName ? payeeName.slice(0, 200) : null,
          payeeKey,
          note: note ? note.slice(0, 500) : null,
          provider,
          externalRef,
          transactionDate,
          committedTransactionId: transaction.id,
          expiresAt: now,
          consumedAt: now,
        },
      });
    }

    if (payeeKey && payeeName) {
      await prisma.quickCapturePayeeRule
        .upsert({
          where: {
            workspaceId_payeeKey: {
              workspaceId: actor.workspaceId,
              payeeKey,
            },
          },
          update: {
            categoryId: selectedCategory.id,
            displayName: payeeName.slice(0, 200),
            useCount: { increment: 1 },
          },
          create: {
            workspaceId: actor.workspaceId,
            payeeKey,
            displayName: payeeName.slice(0, 200),
            categoryId: selectedCategory.id,
            useCount: 1,
          },
        })
        .catch(() => null);
    }

    const formattedAmount = formatServerVnd(amount);
    const dateSuffix =
      transactionDate !== today
        ? ` · ${formatShortReceiptDate(transactionDate)}`
        : "";
    return {
      cancelled: false as const,
      transactionId: transaction.id,
      workflowStatus: transaction.workflowStatus,
      transactionDate,
      amount: amount.toFixed(0),
      formattedAmount,
      categoryName: selectedCategory.name,
      walletName: targetWallet.name,
      description,
      message: `Đã lưu -${formattedAmount}${dateSuffix} · ${selectedCategory.name} (${targetWallet.name})`,
    };
  } catch (error) {
    if (claimedDraftId) {
      await prisma.quickCaptureDraft
        .update({
          where: { id: claimedDraftId },
          data: { consumedAt: null },
        })
        .catch(() => null);
    }
    throw error;
  }
}
