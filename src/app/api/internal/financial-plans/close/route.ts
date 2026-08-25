import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAllFinancialPlanMonthClosures } from "@/services/financial-plan-service";
import { createRequestId, reportServerError } from "@/lib/server-error";

export const dynamic = "force-dynamic";

function workerSecret() {
  const dedicatedSecret = process.env.FINANCIAL_PLAN_WORKER_SECRET;
  if (dedicatedSecret && dedicatedSecret.length >= 32) return dedicatedSecret;
  const authSecret = process.env.NEXTAUTH_SECRET;
  if (!authSecret || authSecret.length < 32) return null;
  return createHash("sha256").update(`financial-plan-worker:${authSecret}`).digest("hex");
}

function isAuthorized(request: Request) {
  const configuredSecret = workerSecret();
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || !authorization?.startsWith("Bearer ")) return false;
  const configured = Buffer.from(configuredSecret);
  const received = Buffer.from(authorization.slice("Bearer ".length));
  return configured.length === received.length && timingSafeEqual(configured, received);
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!workerSecret()) {
    reportServerError(
      "financial_plan_worker.configuration_missing",
      requestId,
      new Error("FINANCIAL_PLAN_WORKER_SECRET and a valid NEXTAUTH_SECRET are both unavailable."),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        message: "Dịch vụ tạm thời chưa sẵn sàng.",
        requestId,
      },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Không được phép truy cập.", requestId },
      { status: 401 },
    );
  }
  try {
    const result = await processAllFinancialPlanMonthClosures();
    return NextResponse.json({ ok: true, requestId, ...result });
  } catch (error) {
    reportServerError("financial_plan_worker.run_failed", requestId, error);
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Không thể đóng kỳ kế hoạch tài chính.",
        requestId,
      },
      { status: 500 },
    );
  }
}
