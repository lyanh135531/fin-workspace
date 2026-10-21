"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import {
  addGoldPurchaseLot,
  createGoldHoldingWithInitialLot,
  createSavingsDeposit,
  deleteGoldHolding,
  deleteGoldPurchaseLot,
  deleteSavingsDeposit,
  recordGoldSale,
  settleSavingsDeposit,
  syncVietnameseGoldMarketQuotes,
  updateGoldHoldingSettings,
} from "@/services/investment-service";

export type InvestmentActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

function revalidateInvestmentPaths() {
  revalidatePath("/investments");
  revalidatePath("/dashboard/investments");
  revalidatePath("/wallets");
  revalidatePath("/dashboard/wallets");
  revalidatePath("/overview");
  revalidatePath("/dashboard");
}

function handleActionError(error: unknown): InvestmentActionState {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      ok: false,
      error: firstIssue?.message ?? "Dữ liệu đầu vào không hợp lệ.",
    };
  }
  if (error instanceof AppError) {
    return {
      ok: false,
      error: error.message,
    };
  }
  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : "Đã xảy ra lỗi khi xử lý yêu cầu.",
  };
}

async function requireSessionAndWorkspace() {
  const session = await requireAcceptedLegalSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) {
    throw new AppError("NOT_FOUND", "Không tìm thấy nhóm tài chính đang hoạt động.");
  }
  return { userId: session.user.id, workspaceId };
}

export async function refreshGoldMarketPricesAction(): Promise<InvestmentActionState> {
  try {
    await requireSessionAndWorkspace();
    await syncVietnameseGoldMarketQuotes(true);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã cập nhật bảng giá vàng mới nhất từ các thương hiệu.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function createGoldHoldingAction(
  rawInput: unknown,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await createGoldHoldingWithInitialLot(userId, workspaceId, rawInput);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã lưu khoản vàng tích sản thành công.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function addGoldPurchaseLotAction(
  rawInput: unknown,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await addGoldPurchaseLot(userId, workspaceId, rawInput);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã ghi nhận đợt mua thêm vàng thành công.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function recordGoldSaleAction(
  rawInput: unknown,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await recordGoldSale(userId, workspaceId, rawInput);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã bán vàng và cộng tiền vào ví thành công.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateGoldHoldingSettingsAction(
  rawInput: unknown,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await updateGoldHoldingSettings(userId, workspaceId, rawInput);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã lưu cài đặt khoản vàng.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteGoldPurchaseLotAction(
  lotId: string,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await deleteGoldPurchaseLot(userId, workspaceId, lotId);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã xóa đợt mua vàng và hoàn lại số dư ví (nếu có).",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteGoldHoldingAction(
  holdingId: string,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await deleteGoldHolding(userId, workspaceId, holdingId);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã xóa khoản vàng tích sản.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function createSavingsDepositAction(
  rawInput: unknown,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await createSavingsDeposit(userId, workspaceId, rawInput);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã mở sổ tiết kiệm thành công.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function settleSavingsDepositAction(
  rawInput: unknown,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await settleSavingsDeposit(userId, workspaceId, rawInput);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã xử lý sổ tiết kiệm và cập nhật số dư ví thành công.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteSavingsDepositAction(
  depositId: string,
): Promise<InvestmentActionState> {
  try {
    const { userId, workspaceId } = await requireSessionAndWorkspace();
    await deleteSavingsDeposit(userId, workspaceId, depositId);
    revalidateInvestmentPaths();
    return {
      ok: true,
      message: "Đã xóa sổ tiết kiệm.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
