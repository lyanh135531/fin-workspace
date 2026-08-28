export type AppErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "LEGAL_CONSENT_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INACTIVE_RESOURCE"
  | "WORKSPACE_ISOLATION_VIOLATION";

export class AppError extends Error {
  public readonly expose: boolean;

  constructor(
    public readonly code: AppErrorCode,
    message: string,
    options: { expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.expose = options.expose ?? true;
  }
}
