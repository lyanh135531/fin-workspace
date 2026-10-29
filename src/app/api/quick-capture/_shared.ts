import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  authenticateQuickCaptureBearer,
  type QuickCaptureActor,
} from "@/services/quick-capture-service";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MAX_BODY_BYTES = 24_576;

const IP_RATE_LIMIT = {
  name: "quick-capture-ip",
  limit: 30,
  windowMs: 60_000,
} as const;

const TOKEN_RATE_LIMIT = {
  name: "quick-capture-token",
  limit: 20,
  windowMs: 60_000,
} as const;

function extractClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp.slice(0, 64);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "unknown";
}

function hasForbiddenQuerySecret(request: NextRequest): boolean {
  const params = request.nextUrl.searchParams;
  return (
    params.has("token") ||
    params.has("access_token") ||
    params.has("api_key") ||
    params.has("key")
  );
}

function buildShortcutSafeErrorPayload(
  message: string,
  code?: string,
): Record<string, unknown> {
  return {
    ok: false,
    ...(code ? { code } : {}),
    message,
    draftId: "",
    prompt: message,
    options: [`Thông báo: ${message}`, "Đóng"],
  };
}

async function parseFlexibleRequestBody(
  request: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        buildShortcutSafeErrorPayload("Nội dung gửi lên vượt quá giới hạn cho phép."),
        { status: 413, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const record: Record<string, unknown> = {};
      let totalChars = 0;
      for (const [key, val] of formData.entries()) {
        if (typeof val === "string") {
          totalChars += key.length + val.length;
          if (totalChars > MAX_BODY_BYTES) {
            return {
              ok: false,
              response: NextResponse.json(
                buildShortcutSafeErrorPayload(
                  "Nội dung gửi lên vượt quá giới hạn cho phép.",
                ),
                { status: 413, headers: NO_STORE_HEADERS },
              ),
            };
          }
          record[key] = val;
        }
      }
      return { ok: true, body: record };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          buildShortcutSafeErrorPayload("Không thể đọc dữ liệu biểu mẫu gửi lên."),
          { status: 400, headers: NO_STORE_HEADERS },
        ),
      };
    }
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        buildShortcutSafeErrorPayload("Không thể đọc nội dung yêu cầu."),
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  if (Buffer.byteLength(rawBodyText, "utf8") > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        buildShortcutSafeErrorPayload("Nội dung gửi lên vượt quá giới hạn cho phép."),
        { status: 413, headers: NO_STORE_HEADERS },
      ),
    };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBodyText);
    return { ok: true, body: Object.fromEntries(params.entries()) };
  }

  try {
    return { ok: true, body: rawBodyText ? JSON.parse(rawBodyText) : {} };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        buildShortcutSafeErrorPayload("Định dạng dữ liệu JSON không hợp lệ."),
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    };
  }
}

export async function authorizeAndParseQuickCaptureRequest(
  request: NextRequest,
): Promise<
  | { ok: true; actor: QuickCaptureActor; body: unknown }
  | { ok: false; response: NextResponse }
> {
  if (hasForbiddenQuerySecret(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        buildShortcutSafeErrorPayload(
          "Không truyền khóa kết nối qua địa chỉ URL. Vui lòng gắn trong phần Header Authorization.",
        ),
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    };
  }

  const ipLimit = checkRateLimit(IP_RATE_LIMIT, extractClientIp(request));
  if (!ipLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        buildShortcutSafeErrorPayload(
          "Thao tác quá nhanh. Vui lòng thử lại sau ít giây.",
        ),
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(
              Math.max(1, Math.ceil(ipLimit.retryAfterMs / 1000)),
            ),
          },
        },
      ),
    };
  }

  let actor: QuickCaptureActor;
  try {
    actor = await authenticateQuickCaptureBearer(
      request.headers.get("authorization"),
    );
  } catch (error) {
    return {
      ok: false,
      response: toQuickCaptureErrorResponse(
        error,
        "Không thể xác thực khóa kết nối thiết bị.",
      ),
    };
  }

  if (actor.tokenId) {
    const tokenLimit = checkRateLimit(TOKEN_RATE_LIMIT, actor.tokenId);
    if (!tokenLimit.allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          buildShortcutSafeErrorPayload(
            "Đã vượt giới hạn yêu cầu mỗi phút cho thiết bị này.",
          ),
          {
            status: 429,
            headers: {
              ...NO_STORE_HEADERS,
              "Retry-After": String(
                Math.max(1, Math.ceil(tokenLimit.retryAfterMs / 1000)),
              ),
            },
          },
        ),
      };
    }
  }

  const parsed = await parseFlexibleRequestBody(request);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, actor, body: parsed.body };
}

export function quickCaptureMethodNotAllowedResponse() {
  return NextResponse.json(
    buildShortcutSafeErrorPayload(
      "Phương thức hiện tại là GET. Vui lòng chuyển sang POST trong cài đặt Phím tắt.",
    ),
    {
      status: 405,
      headers: {
        ...NO_STORE_HEADERS,
        Allow: "POST",
      },
    },
  );
}

export function quickCaptureJson(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export function toQuickCaptureErrorResponse(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0]?.message ?? fallbackMessage;
    return NextResponse.json(buildShortcutSafeErrorPayload(firstIssue), {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  if (error instanceof AppError) {
    const statusMap: Record<AppError["code"], number> = {
      AUTHENTICATION_REQUIRED: 401,
      LEGAL_CONSENT_REQUIRED: 403,
      FORBIDDEN: 403,
      WORKSPACE_ISOLATION_VIOLATION: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION_ERROR: 400,
      INACTIVE_RESOURCE: 400,
    };
    const msg = error.expose ? error.message : fallbackMessage;
    return NextResponse.json(buildShortcutSafeErrorPayload(msg, error.code), {
      status: statusMap[error.code] ?? 400,
      headers: NO_STORE_HEADERS,
    });
  }

  return NextResponse.json(buildShortcutSafeErrorPayload(fallbackMessage), {
    status: 500,
    headers: NO_STORE_HEADERS,
  });
}
