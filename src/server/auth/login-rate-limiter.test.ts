import { describe, expect, it } from "vitest";
import {
  createLoginRateLimiter,
  getLoginRateLimiter,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
} from "./login-rate-limiter";

const KEY = "phone:5512345678";
const OTHER_KEY = "email:mariana@spin.test";
const MINUTE_MS = 60 * 1000;

function setup() {
  let current = new Date("2026-10-21T12:00:00.000Z").getTime();
  const limiter = createLoginRateLimiter({
    now: () => new Date(current),
    maxFailures: LOGIN_MAX_FAILURES,
    windowMs: LOGIN_WINDOW_MS,
  });

  return {
    limiter,
    advance(ms: number) {
      current += ms;
    },
    fail(key: string, times: number) {
      for (let attempt = 0; attempt < times; attempt += 1) {
        limiter.recordFailure(key);
      }
    },
  };
}

describe("createLoginRateLimiter", () => {
  it("allows a key with no failures", () => {
    const { limiter } = setup();

    expect(limiter.check(KEY)).toEqual({ allowed: true });
  });

  it("allows attempts while there are fewer than 5 failures", () => {
    const { limiter, fail } = setup();

    fail(KEY, LOGIN_MAX_FAILURES - 1);

    expect(limiter.check(KEY)).toEqual({ allowed: true });
  });

  it("rejects the 6th attempt with the time left in the window", () => {
    const { limiter, fail, advance } = setup();

    fail(KEY, 1);
    advance(4 * MINUTE_MS);
    fail(KEY, LOGIN_MAX_FAILURES - 1);

    expect(limiter.check(KEY)).toEqual({ allowed: false, retryAfterMs: 11 * MINUTE_MS });
  });

  it("keeps the window anchored at the first failure", () => {
    const { limiter, fail, advance } = setup();

    fail(KEY, LOGIN_MAX_FAILURES);
    advance(5 * MINUTE_MS);
    limiter.recordFailure(KEY);

    expect(limiter.check(KEY)).toEqual({ allowed: false, retryAfterMs: 10 * MINUTE_MS });
  });

  it("allows the key again once the window ends and starts a new count", () => {
    const { limiter, fail, advance } = setup();

    fail(KEY, LOGIN_MAX_FAILURES);
    advance(LOGIN_WINDOW_MS - 1);
    expect(limiter.check(KEY)).toEqual({ allowed: false, retryAfterMs: 1 });

    advance(1);
    expect(limiter.check(KEY)).toEqual({ allowed: true });

    fail(KEY, LOGIN_MAX_FAILURES - 1);
    expect(limiter.check(KEY)).toEqual({ allowed: true });
  });

  it("starts a new window when a failure arrives after the previous one expired", () => {
    const { limiter, fail, advance } = setup();

    fail(KEY, LOGIN_MAX_FAILURES);
    advance(LOGIN_WINDOW_MS);
    fail(KEY, 1);

    expect(limiter.check(KEY)).toEqual({ allowed: true });
  });

  it("clears the counter on reset", () => {
    const { limiter, fail } = setup();

    fail(KEY, LOGIN_MAX_FAILURES);
    limiter.reset(KEY);

    expect(limiter.check(KEY)).toEqual({ allowed: true });
    fail(KEY, LOGIN_MAX_FAILURES - 1);
    expect(limiter.check(KEY)).toEqual({ allowed: true });
  });

  it("keeps two keys independent", () => {
    const { limiter, fail } = setup();

    fail(KEY, LOGIN_MAX_FAILURES);

    expect(limiter.check(KEY).allowed).toBe(false);
    expect(limiter.check(OTHER_KEY)).toEqual({ allowed: true });
  });
});

describe("getLoginRateLimiter", () => {
  it("returns the same process-wide instance", () => {
    expect(getLoginRateLimiter()).toBe(getLoginRateLimiter());
  });

  it("uses the 5 failures in 15 minutes policy", () => {
    const limiter = getLoginRateLimiter();
    const key = "phone:5500000000";

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      limiter.recordFailure(key);
    }

    const result = limiter.check(key);
    limiter.reset(key);

    expect(result.allowed).toBe(false);
    expect(LOGIN_WINDOW_MS).toBe(15 * MINUTE_MS);
  });
});
