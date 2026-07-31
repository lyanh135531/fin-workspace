import type {
  InvestmentAssetType,
  Prisma,
} from "@/generated/prisma/client";
import type { SaveInvestmentLeafInput } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export const INVESTMENT_ROOT_SYSTEM_KEY = "INVESTMENT_ROOT";
export const INVESTMENT_ROOT_CODE = "INVESTMENT_ROOT";

export const INVESTMENT_BRANCH_DEFINITIONS = [
  {
    systemKey: "INVESTMENT_GOLD",
    name: "Gold",
    code: "INVESTMENT_GOLD",
    color: "#D97706",
    icon: "coins",
    sortOrder: 0,
    assetType: "gold",
    defaultUnit: "chỉ",
  },
  {
    systemKey: "INVESTMENT_MONEY",
    name: "Money",
    code: "INVESTMENT_MONEY",
    color: "#059669",
    icon: "banknote",
    sortOrder: 1,
    assetType: "currency",
    defaultUnit: "USD",
  },
  {
    systemKey: "INVESTMENT_FUND",
    name: "Fund",
    code: "INVESTMENT_FUND",
    color: "#7C3AED",
    icon: "chart-no-axes-combined",
    sortOrder: 2,
    assetType: "fund",
    defaultUnit: "chứng chỉ quỹ",
  },
] as const satisfies ReadonlyArray<{
  systemKey: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  sortOrder: number;
  assetType: InvestmentAssetType;
  defaultUnit: string;
}>;

const branchKeys = INVESTMENT_BRANCH_DEFINITIONS.map(
  (branch) => branch.systemKey,
);

export function investmentAssetTypeForBranch(systemKey: string | null) {
  return INVESTMENT_BRANCH_DEFINITIONS.find(
    (branch) => branch.systemKey === systemKey,
  )?.assetType ?? null;
}

export async function ensureInvestmentRootInTransaction(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  let root = await tx.category.findFirst({
    where: {
      workspaceId,
      systemKey: INVESTMENT_ROOT_SYSTEM_KEY,
    },
  });
  if (!root) {
    root = await tx.category.create({
      data: {
        workspaceId,
        name: "Đầu tư",
        code: INVESTMENT_ROOT_CODE,
        color: "#2563EB",
        type: "investment",
        icon: "briefcase",
        systemKey: INVESTMENT_ROOT_SYSTEM_KEY,
        isProtected: true,
        sortOrder: 900,
      },
    });
  } else if (
    root.name !== "Đầu tư"
    || root.code !== INVESTMENT_ROOT_CODE
    || root.color !== "#2563EB"
    || root.icon !== "briefcase"
    || root.sortOrder !== 900
    || root.parentId !== null
    || root.deletedAt
    || root.status !== "active"
    || !root.isProtected
    || root.type !== "investment"
  ) {
    root = await tx.category.update({
      where: { id: root.id },
      data: {
        name: "Đầu tư",
        code: INVESTMENT_ROOT_CODE,
        color: "#2563EB",
        icon: "briefcase",
        parentId: null,
        sortOrder: 900,
        deletedAt: null,
        status: "active",
        isProtected: true,
        type: "investment",
      },
    });
  }

  for (const definition of INVESTMENT_BRANCH_DEFINITIONS) {
    const existing = await tx.category.findFirst({
      where: {
        workspaceId,
        systemKey: definition.systemKey,
      },
    });
    if (existing) {
      if (
        existing.name !== definition.name
        || existing.code !== definition.code
        || existing.color !== definition.color
        || existing.type !== "investment"
        || existing.icon !== definition.icon
        || existing.parentId !== root.id
        || !existing.isProtected
        || existing.sortOrder !== definition.sortOrder
        || existing.status !== "active"
        || existing.deletedAt
      ) {
        await tx.category.update({
          where: { id: existing.id },
          data: {
            name: definition.name,
            code: definition.code,
            color: definition.color,
            type: "investment",
            icon: definition.icon,
            parentId: root.id,
            isProtected: true,
            sortOrder: definition.sortOrder,
            status: "active",
            deletedAt: null,
          },
        });
      }
      continue;
    }
    await tx.category.create({
      data: {
        workspaceId,
        name: definition.name,
        code: definition.code,
        color: definition.color,
        type: "investment",
        icon: definition.icon,
        parentId: root.id,
        systemKey: definition.systemKey,
        isProtected: true,
        sortOrder: definition.sortOrder,
      },
    });
  }

  return root;
}

export async function ensureInvestmentRoot(workspaceId: string) {
  return prisma.$transaction((tx) =>
    ensureInvestmentRootInTransaction(tx, workspaceId),
  );
}

function normalizedLeafUnit(
  assetType: InvestmentAssetType,
  unit: string,
) {
  const normalized = assetType === "currency"
    ? unit.toUpperCase()
    : unit;
  if (assetType === "currency" && !/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Đơn vị của Money phải là mã tiền tệ gồm 3 ký tự, ví dụ USD hoặc CAD.",
    );
  }
  return normalized;
}

export async function saveInvestmentLeaf(
  userId: string,
  workspaceId: string,
  input: SaveInvestmentLeafInput,
) {
  await requireWorkspaceMember(userId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    const root = await ensureInvestmentRootInTransaction(tx, workspaceId);
    const parent = await tx.category.findFirst({
      where: {
        id: input.parentId,
        workspaceId,
        parentId: root.id,
        systemKey: { in: branchKeys },
        isProtected: true,
        type: "investment",
        status: "active",
        deletedAt: null,
      },
    });
    const assetType = investmentAssetTypeForBranch(parent?.systemKey ?? null);
    if (!parent || !assetType) {
      throw new AppError(
        "NOT_FOUND",
        "Nhánh đầu tư cha không hợp lệ.",
      );
    }
    const unit = normalizedLeafUnit(assetType, input.unit);

    const duplicateCategory = await tx.category.findFirst({
      where: {
        workspaceId,
        code: { equals: input.code, mode: "insensitive" },
        deletedAt: null,
        ...(input.id ? { id: { not: input.id } } : {}),
      },
      select: { id: true },
    });
    if (duplicateCategory) {
      throw new AppError(
        "CONFLICT",
        `Mã hạng mục “${input.code}” đã tồn tại.`,
      );
    }

    const current = input.id
      ? await tx.category.findFirst({
        where: {
          id: input.id,
          workspaceId,
          parentId: parent.id,
          isProtected: false,
          type: "investment",
          deletedAt: null,
        },
        include: {
          children: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
          },
          investmentAsset: {
            include: {
              _count: {
                select: {
                  lots: true,
                  trades: true,
                  prices: true,
                },
              },
            },
          },
        },
      })
      : null;
    if (input.id && !current) {
      throw new AppError("NOT_FOUND", "Không tìm thấy hạng mục cần cập nhật.");
    }
    if (current?.children.length) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Chỉ nhánh lá mới có thể được cấu hình để giao dịch.",
      );
    }

    const duplicateAsset = await tx.investmentAsset.findFirst({
      where: {
        workspaceId,
        code: { equals: input.code, mode: "insensitive" },
        ...(current?.investmentAsset
          ? { id: { not: current.investmentAsset.id } }
          : {}),
      },
      select: { id: true },
    });
    if (duplicateAsset) {
      throw new AppError(
        "CONFLICT",
        `Mã tài sản “${input.code}” đã tồn tại.`,
      );
    }

    if (
      current?.investmentAsset
      && current.investmentAsset.unit !== unit
      && (
        current.investmentAsset._count.lots > 0
        || current.investmentAsset._count.trades > 0
      )
    ) {
      throw new AppError(
        "CONFLICT",
        "Không thể đổi đơn vị vì hạng mục đã có giao dịch.",
      );
    }

    if (input.status === "deactive" && current?.investmentAsset) {
      const openLots = await tx.investmentLot.count({
        where: {
          assetId: current.investmentAsset.id,
          status: { in: ["open", "partial"] },
          remainingQuantity: { gt: 0 },
        },
      });
      if (openLots > 0) {
        throw new AppError(
          "CONFLICT",
          "Không thể ngừng hạng mục khi vẫn còn lô đang nắm giữ.",
        );
      }
    }

    const category = current
      ? await tx.category.update({
        where: { id: current.id },
        data: {
          name: input.name,
          code: input.code,
          parentId: parent.id,
          color: parent.color,
          status: input.status,
        },
      })
      : await tx.category.create({
        data: {
          workspaceId,
          name: input.name,
          code: input.code,
          color: parent.color,
          type: "investment",
          icon: "tag",
          parentId: parent.id,
          status: input.status,
        },
      });

    const priceSymbol = assetType === "gold"
      ? "XAUUSD"
      : assetType === "currency"
        ? `${unit}VND`
        : null;
    const autoPriceEnabled = assetType === "gold" || assetType === "currency";
    const assetData = {
      code: input.code,
      name: input.name,
      type: assetType,
      unit,
      quoteCurrency: "VND",
      priceSymbol,
      autoPriceEnabled,
      status: input.status,
      deletedAt: null,
    } as const;

    let asset;
    if (current?.investmentAsset) {
      if (
        current.investmentAsset.unit !== unit
        && current.investmentAsset._count.prices > 0
      ) {
        await tx.assetPriceSnapshot.deleteMany({
          where: { assetId: current.investmentAsset.id },
        });
      }
      asset = await tx.investmentAsset.update({
        where: { id: current.investmentAsset.id },
        data: assetData,
      });
    } else {
      asset = await tx.investmentAsset.create({
        data: {
          workspaceId,
          categoryId: category.id,
          ...assetData,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: current
          ? "investment.leaf_updated"
          : "investment.leaf_created",
        entityType: "investment_asset",
        entityId: asset.id,
        metadata: {
          categoryId: category.id,
          parentId: parent.id,
          type: assetType,
          unit,
          status: input.status,
        },
      },
    });
    return { category, asset };
  });
}
