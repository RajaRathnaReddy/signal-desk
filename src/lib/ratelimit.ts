/**
 * Fixed-window-with-burst rate limiter. In-memory, per process.
 * For multi-instance deployments swap `store` for Redis (INCR + EXPIRE) behind the same function signature.
 */
interface Bucket { count: number; resetAt: number }
const store = new Map<string, Bucket>();

export interface RateResult { ok: boolean; remaining: number; retryAfterSec: number }

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  if (store.size > 5000) for (const [k, b] of store) if (b.resetAt < now) store.delete(k);
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

export function resetRateLimits() {
  store.clear();
}
