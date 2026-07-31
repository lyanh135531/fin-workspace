/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each key (e.g. an IP address or action name) is tracked independently.
 * When `check()` is called, it removes expired entries and returns whether
 * the key is within the configured limit.
 *
 * NOTE: This resets on server restart and is per-process only. For
 * multi-instance deployments, use a shared store (e.g. Redis).
 */

const stores = new Map<string, Map<string, number[]>>();

export interface RateLimitConfig {
  /** Unique name for this limiter (used to isolate stores). */
  name: string;
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(config: RateLimitConfig, key: string): RateLimitResult {
  const now = Date.now();

  if (!stores.has(config.name)) stores.set(config.name, new Map());
  const store = stores.get(config.name)!;

  const timestamps = (store.get(key) ?? []).filter((t) => now - t < config.windowMs);
  store.set(key, timestamps);

  if (timestamps.length >= config.limit) {
    const oldest = timestamps[0]!;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: config.windowMs - (now - oldest),
    };
  }

  timestamps.push(now);
  return {
    allowed: true,
    remaining: config.limit - timestamps.length,
    retryAfterMs: 0,
  };
}
