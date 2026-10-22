import "server-only";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type RateLimitCheck = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface LoginRateLimiter {
  check(key: string): RateLimitCheck;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export interface LoginRateLimiterOptions {
  now: () => Date;
  maxFailures: number;
  windowMs: number;
}

interface FailureWindow {
  failures: number;
  startedAt: number;
}

export function createLoginRateLimiter({ now, maxFailures, windowMs }: LoginRateLimiterOptions): LoginRateLimiter {
  const windows = new Map<string, FailureWindow>();

  function activeWindow(key: string, at: number): FailureWindow | undefined {
    const entry = windows.get(key);

    if (entry && at - entry.startedAt >= windowMs) {
      windows.delete(key);
      return undefined;
    }

    return entry;
  }

  return {
    check(key) {
      const at = now().getTime();
      const entry = activeWindow(key, at);

      if (!entry || entry.failures < maxFailures) {
        return { allowed: true };
      }

      return { allowed: false, retryAfterMs: entry.startedAt + windowMs - at };
    },

    recordFailure(key) {
      const at = now().getTime();
      const entry = activeWindow(key, at);

      if (entry) {
        entry.failures += 1;
        return;
      }

      windows.set(key, { failures: 1, startedAt: at });
    },

    reset(key) {
      windows.delete(key);
    },
  };
}

const LIMITER_KEY = Symbol.for("smw.loginRateLimiter");

type GlobalWithLimiter = typeof globalThis & { [LIMITER_KEY]?: LoginRateLimiter };

export function getLoginRateLimiter(): LoginRateLimiter {
  const globalWithLimiter = globalThis as GlobalWithLimiter;

  globalWithLimiter[LIMITER_KEY] ??= createLoginRateLimiter({
    now: () => new Date(),
    maxFailures: LOGIN_MAX_FAILURES,
    windowMs: LOGIN_WINDOW_MS,
  });

  return globalWithLimiter[LIMITER_KEY];
}
