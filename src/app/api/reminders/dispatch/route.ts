import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { dispatchDueDailyReminders } from "@/services/reminder-service";

function verifyBearerSecret(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length).trim();
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expectedSecret, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  let authorized = false;
  if (cronSecret && verifyBearerSecret(authHeader, cronSecret)) {
    authorized = true;
  } else {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { ok: false, message: "Không có quyền thực hiện thao tác này." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await dispatchDueDailyReminders();
    return NextResponse.json(
      { ok: true, ...result },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Không thể xử lý lịch nhắc nhở." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
