import type { AppError } from "@/lib/errors";

export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function failure<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
