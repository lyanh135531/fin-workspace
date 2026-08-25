import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { getPublicError, toActionFailure } from "@/lib/server-error";

describe("production error mapping", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns public AppError messages", () => {
    expect(getPublicError(new AppError("CONFLICT", "Tên đã tồn tại."), "Thử lại.")).toEqual({
      code: "CONFLICT",
      message: "Tên đã tồn tại.",
      shouldLog: false,
    });
  });

  it("does not expose raw Zod messages", () => {
    const result = z.object({ amount: z.number() }).safeParse({ amount: "10" });
    if (result.success) throw new Error("Test fixture must fail validation.");

    expect(getPublicError(result.error, "Thử lại.")).toEqual({
      code: "INVALID_INPUT",
      message: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
      shouldLog: false,
    });
  });

  it("hides and logs unexpected errors with a request ID", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = toActionFailure(
      new Error("password_hash constraint failed"),
      "Không thể lưu thay đổi.",
      { event: "test.failed", requestId: "request-123" },
    );

    expect(failure).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Không thể lưu thay đổi.",
      requestId: "request-123",
    });
    expect(log).toHaveBeenCalledWith(
      "[felix-error]",
      expect.objectContaining({
        event: "test.failed",
        requestId: "request-123",
        errorMessage: "password_hash constraint failed",
      }),
    );
  });

  it("does not expose AppErrors marked as internal", () => {
    const error = new AppError("NOT_FOUND", "The ADMIN role is missing.", {
      expose: false,
    });

    expect(getPublicError(error, "Không thể tạo nhóm tài chính.")).toEqual({
      code: "INTERNAL_ERROR",
      message: "Không thể tạo nhóm tài chính.",
      shouldLog: true,
    });
  });
});
