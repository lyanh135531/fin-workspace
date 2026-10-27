import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
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
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, message: "Chưa cấu hình CRON_SECRET." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!verifyBearerSecret(authHeader, cronSecret)) {
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
