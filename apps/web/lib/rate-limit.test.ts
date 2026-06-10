import { describe, expect, it } from "vitest";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit, then denies within the window", () => {
    const key = "test:allow-then-deny";
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    const denied = rateLimit(key, 2, 60_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the counter on rateLimitReset (e.g. after a successful login)", () => {
    const key = "test:reset";
    rateLimit(key, 1, 60_000); // consume the only slot
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false);
    rateLimitReset(key);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
  });

  it("keeps separate counters per key", () => {
    expect(rateLimit("test:key-a", 1, 60_000).allowed).toBe(true);
    expect(rateLimit("test:key-b", 1, 60_000).allowed).toBe(true);
  });
});
