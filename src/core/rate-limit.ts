import { ODriveError } from "@/core/errors";

/**
 * Fixed-window rate limiter behind a swappable adapter interface (memory today,
 * Durable Object / KV later). Stateless callers only see consume()/assert().
 */
export interface RateLimitAdapter {
  hit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number };
  reset(key: string): void;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export const memoryRateLimitAdapter: RateLimitAdapter = {
  hit(key, limit, windowMs) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }
    bucket.count += 1;
    return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
  },
  reset(key) {
    buckets.delete(key);
  },
};

let adapter: RateLimitAdapter = memoryRateLimitAdapter;

export const configureRateLimiter = (next: RateLimitAdapter) => {
  adapter = next;
};

/** Named policies for every critical operation. */
export const RATE_LIMITS = {
  "auth.magic-link": { limit: 5, windowMs: 15 * 60_000 },
  "auth.verify": { limit: 10, windowMs: 15 * 60_000 },
  "share.password": { limit: 5, windowMs: 10 * 60_000 },
  "share.access": { limit: 60, windowMs: 60_000 },
  "upload.enqueue": { limit: 120, windowMs: 60_000 },
  "credential.reveal": { limit: 10, windowMs: 60 * 60_000 },
  "provider.call": { limit: 300, windowMs: 60_000 },
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export function consume(policy: RateLimitPolicy, identifier: string) {
  const { limit, windowMs } = RATE_LIMITS[policy];
  return adapter.hit(`${policy}:${identifier}`, limit, windowMs);
}

/** Throws a normalised RATE_LIMITED error when the policy is exhausted. */
export function assertWithinLimit(policy: RateLimitPolicy, identifier: string): void {
  const result = consume(policy, identifier);
  if (result.allowed) return;
  const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  throw new ODriveError("RATE_LIMITED", {
    message: `Too many attempts. Try again in ${seconds}s.`,
    context: { policy },
  });
}

export const resetLimit = (policy: RateLimitPolicy, identifier: string) =>
  adapter.reset(`${policy}:${identifier}`);
