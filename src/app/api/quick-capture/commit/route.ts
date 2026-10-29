import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import {
  authorizeAndParseQuickCaptureRequest,
  quickCaptureJson,
  quickCaptureMethodNotAllowedResponse,
  toQuickCaptureErrorResponse,
} from "@/app/api/quick-capture/_shared";
import { commitQuickCapture } from "@/services/quick-capture-service";

export function GET() {
  return quickCaptureMethodNotAllowedResponse();
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAndParseQuickCaptureRequest(request);
  if (!authorized.ok) {
    return authorized.response;
  }

  try {
    const result = await commitQuickCapture(authorized.actor, authorized.body);

    if (!result.cancelled) {
      revalidatePath("/dashboard");
      revalidatePath("/overview");
      revalidatePath("/dashboard/overview");
      revalidatePath("/wallets");
      revalidatePath("/dashboard/wallets");
      revalidatePath("/financial-plans");
      revalidatePath("/dashboard/financial-plans");
      revalidatePath(`/workspace/${authorized.actor.workspaceId}`);
    }

    return quickCaptureJson({
      ok: true,
      ...result,
    });
  } catch (error) {
    return toQuickCaptureErrorResponse(
      error,
      "Không thể lưu giao dịch vào sổ lúc này.",
    );
  }
}
