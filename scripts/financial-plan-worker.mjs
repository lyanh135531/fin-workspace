import { createHash } from "node:crypto";

const endpoint = process.env.FINANCIAL_PLAN_WORKER_URL ?? "http://app:15730/api/internal/financial-plans/close";
const dedicatedSecret = process.env.FINANCIAL_PLAN_WORKER_SECRET;
const authSecret = process.env.NEXTAUTH_SECRET;
const secret = dedicatedSecret?.length >= 32
  ? dedicatedSecret
  : authSecret?.length >= 32
    ? createHash("sha256").update(`financial-plan-worker:${authSecret}`).digest("hex")
    : null;
const configuredInterval = Number.parseInt(process.env.FINANCIAL_PLAN_WORKER_INTERVAL_MS ?? "300000", 10);
const intervalMs = Number.isFinite(configuredInterval) && configuredInterval >= 60_000
  ? configuredInterval
  : 300_000;

if (!secret || secret.length < 32) {
  throw new Error("Configure FINANCIAL_PLAN_WORKER_SECRET or a NEXTAUTH_SECRET with at least 32 characters.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function run() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(55_000),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
    const result = JSON.parse(body);
    if (result.closedMonths || result.completedPlans) {
      console.info("[financial-plan-worker]", new Date().toISOString(), result);
    }
  } catch (error) {
    console.error(
      "[financial-plan-worker]",
      new Date().toISOString(),
      error instanceof Error ? error.message : error,
    );
  }
}

for (;;) {
  await run();
  await delay(intervalMs);
}
