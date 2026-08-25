import { z } from "zod";

import { AppError, type AppErrorCode } from "@/lib/errors";

export type PublicErrorCode = AppErrorCode | "INVALID_INPUT" | "INTERNAL_ERROR";

export type ActionFailure = {
  ok: false;
  code: PublicErrorCode;
  message: string;
  requestId: string;
};

type PublicError = {
  code: PublicErrorCode;
  message: string;
  shouldLog: boolean;
};

const INVALID_INPUT_MESSAGE = "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.";

export function createRequestId() {
  return crypto.randomUUID();
}

export function getPublicError(error: unknown, fallback: string): PublicError {
  if (error instanceof AppError && error.expose) {
    return { code: error.code, message: error.message, shouldLog: false };
  }

  if (error instanceof z.ZodError) {
    return {
      code: "INVALID_INPUT",
      message: INVALID_INPUT_MESSAGE,
      shouldLog: false,
    };
  }

  return { code: "INTERNAL_ERROR", message: fallback, shouldLog: true };
}

export function reportServerError(
  event: string,
  requestId: string,
  error: unknown,
  details: Record<string, unknown> = {},
) {
  const normalized =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      : { errorName: "UnknownError", errorMessage: String(error) };

  console.error("[felix-error]", {
    event,
    requestId,
    at: new Date().toISOString(),
    ...details,
    ...normalized,
  });
}

export function toActionFailure(
  error: unknown,
  fallback: string,
  options: {
    event: string;
    requestId?: string;
    details?: Record<string, unknown>;
  },
): ActionFailure {
  const requestId = options.requestId ?? createRequestId();
  const publicError = getPublicError(error, fallback);

  if (publicError.shouldLog) {
    reportServerError(options.event, requestId, error, options.details);
  }

  return {
    ok: false,
    code: publicError.code,
    message: publicError.message,
    requestId,
  };
}
