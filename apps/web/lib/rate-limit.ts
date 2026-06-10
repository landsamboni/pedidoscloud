/**
 * Best-effort in-process rate limiter (fixed window).
 *
 * IMPORTANT: state lives in the Lambda instance's memory, so it is per-instance
 * and resets on cold start. On serverless this meaningfully raises the cost of
 * naive brute-force (which hammers a warm instance) but is NOT a complete
 * control — enable **Cloudflare Rate Limiting** on /login as the authoritative
 * edge defense. This module adds zero infrastructure and zero dependencies.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000; // hard cap so a key-flood can't grow memory

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Drop expired buckets; if still over the cap, clear everything (cheap reset). */
function sweep(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
}

/**
 * Record one attempt for `key` and report whether it is allowed.
 * Allows up to `limit` attempts per `windowMs`; further attempts are denied
 * until the window resets.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clear a key's counter — call after a successful login so it isn't penalized. */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
