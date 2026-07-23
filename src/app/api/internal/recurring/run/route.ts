import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAllDueRecurringTransactions } from "@/services/recurring-transaction-service";

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
  if (!workerSecret()) {
    return NextResponse.json(
      { ok: false, message: "Recurring worker secret is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const result = await processAllDueRecurringTransactions();
  return NextResponse.json({ ok: true, ...result });
}
