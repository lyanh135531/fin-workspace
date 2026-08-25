import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAllFinancialPlanMonthClosures } from "@/services/financial-plan-service";

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
  if (!workerSecret()) return NextResponse.json({ ok: false, message: "Financial plan worker secret is not configured." }, { status: 503 });
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  const result = await processAllFinancialPlanMonthClosures();
  return NextResponse.json({ ok: true, ...result });
}
