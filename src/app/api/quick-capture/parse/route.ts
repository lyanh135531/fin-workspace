import type { NextRequest } from "next/server";
import {
  authorizeAndParseQuickCaptureRequest,
  quickCaptureJson,
  quickCaptureMethodNotAllowedResponse,
  toQuickCaptureErrorResponse,
} from "@/app/api/quick-capture/_shared";
import { prepareQuickCapture } from "@/services/quick-capture-service";

export function GET() {
  return quickCaptureMethodNotAllowedResponse();
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAndParseQuickCaptureRequest(request);
  if (!authorized.ok) {
    return authorized.response;
  }

  try {
    const prepared = await prepareQuickCapture(
      authorized.actor,
      authorized.body,
    );
    return quickCaptureJson({
      ok: true,
      ...prepared,
    });
  } catch (error) {
    return toQuickCaptureErrorResponse(
      error,
      "Không thể đọc biên lai thanh toán lúc này.",
    );
  }
}
