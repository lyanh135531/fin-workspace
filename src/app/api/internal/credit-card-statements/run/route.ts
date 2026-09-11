import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generateDueCreditCardStatements } from "@/services/credit-card-statement-service";
import { createRequestId, reportServerError } from "@/lib/server-error";

export const dynamic = "force-dynamic";

function workerSecret() {
  const dedicated = process.env.RECURRING_WORKER_SECRET;
  if (dedicated && dedicated.length >= 32) return dedicated;
  const authSecret = process.env.NEXTAUTH_SECRET;
  return authSecret && authSecret.length >= 32
    ? createHash("sha256").update(`recurring-worker:${authSecret}`).digest("hex")
    : null;
}

function authorized(request: Request) {
  const expected = workerSecret();
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice(7));
  const configured = Buffer.from(expected);
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!workerSecret()) return NextResponse.json({ ok: false, code: "SERVICE_UNAVAILABLE", requestId }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ ok: false, code: "UNAUTHORIZED", requestId }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, requestId, ...(await generateDueCreditCardStatements()) });
  } catch (error) {
    reportServerError("credit_card_statement_worker.run_failed", requestId, error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Không thể chốt sao kê thẻ.", requestId }, { status: 500 });
  }
}
