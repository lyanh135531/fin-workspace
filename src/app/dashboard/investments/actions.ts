"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth";
import {
  createInvestmentTradeSchema,
  recordAssetPriceSchema,
  saveInvestmentLeafSchema,
} from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import {
  saveInvestmentLeaf,
} from "@/services/investment-category-service";
import {
  createInvestmentTrade,
  recordAssetPrice,
  refreshInvestmentMarketPrices,
} from "@/services/investment-service";

async function investmentActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AppError("AUTHENTICATION_REQUIRED", "Vui lòng đăng nhập.");
  }
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) {
    throw new AppError("FORBIDDEN", "Không có workspace đang hoạt động.");
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
      workspace: { status: "active", deletedAt: null },
    },
    select: { workspaceId: true },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập workspace này.");
  }
  return { userId: session.user.id, workspaceId };
}

function revalidateInvestmentViews() {
  revalidatePath("/investments");
  revalidatePath("/wallets");
  revalidatePath("/overview");
  revalidatePath("/dashboard");
}

function actionError(error: unknown, fallback: string) {
  return {
    ok: false as const,
    message: error instanceof Error ? error.message : fallback,
  };
}

export async function saveInvestmentLeafAction(input: unknown) {
  try {
    const actor = await investmentActor();
    await saveInvestmentLeaf(
      actor.userId,
      actor.workspaceId,
      saveInvestmentLeafSchema.parse(input),
    );
    revalidateInvestmentViews();
    return { ok: true as const };
  } catch (error) {
    return actionError(error, "Không thể lưu hạng mục đầu tư.");
  }
}

export async function createInvestmentTradeAction(input: unknown) {
  try {
    const actor = await investmentActor();
    const trade = await createInvestmentTrade(
      actor.userId,
      actor.workspaceId,
      createInvestmentTradeSchema.parse(input),
    );
    revalidateInvestmentViews();
    return { ok: true as const, status: trade.workflowStatus };
  } catch (error) {
    return actionError(error, "Không thể ghi nhận giao dịch đầu tư.");
  }
}

export async function recordAssetPriceAction(input: unknown) {
  try {
    const actor = await investmentActor();
    await recordAssetPrice(
      actor.userId,
      actor.workspaceId,
      recordAssetPriceSchema.parse(input),
    );
    revalidateInvestmentViews();
    return { ok: true as const };
  } catch (error) {
    return actionError(error, "Không thể cập nhật giá tài sản.");
  }
}

export async function refreshInvestmentMarketPricesAction() {
  try {
    const actor = await investmentActor();
    const result = await refreshInvestmentMarketPrices(
      actor.userId,
      actor.workspaceId,
    );
    revalidateInvestmentViews();
    return {
      ok: true as const,
      count: result.results.length,
      priceAt: result.priceAt.toISOString(),
    };
  } catch (error) {
    return actionError(error, "Không thể cập nhật giá thị trường.");
  }
}
