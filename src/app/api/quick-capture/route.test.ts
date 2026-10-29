import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const authenticateMock = vi.fn();
const prepareMock = vi.fn();
const commitMock = vi.fn();

vi.mock("@/services/quick-capture-service", () => ({
  authenticateQuickCaptureBearer: (...args: unknown[]) =>
    authenticateMock(...args),
  prepareQuickCapture: (...args: unknown[]) => prepareMock(...args),
  commitQuickCapture: (...args: unknown[]) => commitMock(...args),
}));

import {
  GET as parseGet,
  POST as parsePost,
} from "@/app/api/quick-capture/parse/route";
import { POST as commitPost } from "@/app/api/quick-capture/commit/route";

describe("quick capture API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 with 2-item Vietnamese setup hint so iOS Shortcuts Choose from List pops up", async () => {
    const res = parseGet();
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.options).toEqual([
      `Thông báo: ${json.message}`,
      "Đóng",
    ]);
  });

  it("rejects tokens passed via URL query string", async () => {
    const req = new NextRequest(
      "https://app.felixwise.io.vn/api/quick-capture/parse?token=flx_qc_secret",
      {
        method: "POST",
        body: JSON.stringify({ text: "MoMo -45.000đ" }),
      },
    );

    const res = await parsePost(req);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.options).toEqual([
      `Thông báo: ${json.message}`,
      "Đóng",
    ]);
    expect(authenticateMock).not.toHaveBeenCalled();
  });

  it("returns 401 with 2-item Shortcut-safe fallback options when Authorization header is invalid", async () => {
    authenticateMock.mockRejectedValueOnce(
      new AppError("AUTHENTICATION_REQUIRED", "Thiếu khóa kết nối thiết bị."),
    );

    const req = new NextRequest(
      "https://app.felixwise.io.vn/api/quick-capture/parse",
      {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ text: "MoMo -45.000đ" }),
      },
    );

    const res = await parsePost(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.options).toEqual([
      "Thông báo: Thiếu khóa kết nối thiết bị.",
      "Đóng",
    ]);
  });

  it("accepts both JSON and application/x-www-form-urlencoded payloads", async () => {
    const actor = {
      userId: "user-1",
      workspaceId: "ws-1",
      timeZone: "Asia/Ho_Chi_Minh",
      defaultWalletId: "wallet-1",
      defaultCategoryId: null,
      tokenId: "token-1",
    };
    authenticateMock.mockResolvedValue(actor);
    prepareMock.mockResolvedValueOnce({
      draftId: "550e8400-e29b-41d4-a716-446655440099",
      prompt: "-45.000đ · NGUYEN VAN A (Ví MoMo)",
      options: ["Ăn uống · Gợi ý", "Di chuyển", "Bỏ qua giao dịch"],
    });

    const parseReq = new NextRequest(
      "https://app.felixwise.io.vn/api/quick-capture/parse",
      {
        method: "POST",
        headers: {
          authorization: "Bearer flx_qc_valid_test_token_1234567890",
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-for": "203.0.113.11",
        },
        body: new URLSearchParams({
          text: "Giao dịch thành công -45.000đ",
        }).toString(),
      },
    );

    const parseRes = await parsePost(parseReq);
    expect(parseRes.status).toBe(200);
    const parseBody = await parseRes.json();
    expect(parseBody.ok).toBe(true);
    expect(parseBody.options[0]).toBe("Ăn uống · Gợi ý");

    commitMock.mockResolvedValueOnce({
      cancelled: false,
      transactionId: "tx-1",
      workflowStatus: "approved",
      amount: "45000",
      formattedAmount: "45.000đ",
      categoryName: "Ăn uống",
      walletName: "Ví MoMo",
      description: "[MoMo] NGUYEN VAN A",
      message: "Đã lưu -45.000đ · Ăn uống (Ví MoMo)",
    });

    const commitReq = new NextRequest(
      "https://app.felixwise.io.vn/api/quick-capture/commit",
      {
        method: "POST",
        headers: {
          authorization: "Bearer flx_qc_valid_test_token_1234567890",
          "x-forwarded-for": "203.0.113.11",
        },
        body: JSON.stringify({
          draftId: "550e8400-e29b-41d4-a716-446655440099",
          selectedOption: "Ăn uống · Gợi ý",
        }),
      },
    );

    const commitRes = await commitPost(commitReq);
    expect(commitRes.status).toBe(200);
    const commitBody = await commitRes.json();
    expect(commitBody.ok).toBe(true);
    expect(commitBody.workflowStatus).toBe("approved");
  });
});
