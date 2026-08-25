import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAllDueRecurringTransactions } from "@/services/recurring-transaction-service";
import { createRequestId, reportServerError } from "@/lib/server-error";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const configuredSecret = workerSecret();
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || !authorization?.startsWith("Bearer ")) return false;
  const receivedSecret = authorization.slice("Bearer ".length);
  const configured = Buffer.from(configuredSecret);
  const received = Buffer.from(receivedSecret);
  return configured.length === received.length && timingSafeEqual(configured, received);
}

function workerSecret() {
  const dedicatedSecret = process.env.RECURRING_WORKER_SECRET;
  if (dedicatedSecret && dedicatedSecret.length >= 32) return dedicatedSecret;
  const authSecret = process.env.NEXTAUTH_SECRET;
  if (!authSecret || authSecret.length < 32) return null;
  return createHash("sha256").update(`recurring-worker:${authSecret}`).digest("hex");
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!workerSecret()) {
    reportServerError(
      "recurring_worker.configuration_missing",
      requestId,
      new Error("RECURRING_WORKER_SECRET and a valid NEXTAUTH_SECRET are both unavailable."),
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
    const result = await processAllDueRecurringTransactions();
    return NextResponse.json({ ok: true, requestId, ...result });
  } catch (error) {
    reportServerError("recurring_worker.run_failed", requestId, error);
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Không thể xử lý giao dịch định kỳ.",
        requestId,
      },
      { status: 500 },
    );
  }
}
