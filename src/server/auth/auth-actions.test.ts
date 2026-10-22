import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_METHOD } from "@/domain/user/schemas";
import { AUTH_FAILURE_KIND } from "@/shared/lib/auth/form-state";
import { ERROR_SOURCE } from "@/shared/observability/error-reporter";
import { createJsonDatabase } from "../db/json-database";
import { createSeed } from "../db/seed";
import { createAuthService } from "../services/auth-service";
import { SERVICE_ERROR_CODE } from "../services/types";
import { createAuthActions, loginRateLimitKey, type AuthActionDependencies, type LoginCredentials } from "./auth-actions";
import { createLoginRateLimiter, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "./login-rate-limiter";

const REQUEST_ID = "req-auth-1";
const NOW = new Date("2026-10-21T12:00:00.000Z");
const MARIANA_PHONE = "55 1234 5678";
const MARIANA_PASSWORD = "Spin2026";
const WRONG_PASSWORD = "Wrong2026";

let tempDir: string;
let seedContents: string;
let idCounter: number;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-auth-actions-"));
  seedContents = JSON.stringify(await createSeed(NOW));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
  idCounter = 0;
});

function buildDeps() {
  let current = NOW.getTime();
  const dbPath = join(tempDir, `db-${crypto.randomUUID()}.json`);
  const auth = createAuthService({
    db: createJsonDatabase(dbPath, () => JSON.parse(seedContents)),
    now: () => new Date(current),
    random: () => 0.5,
    createId: () => `id${idCounter++}`,
  });
  const deps = {
    auth,
    rateLimiter: createLoginRateLimiter({
      now: () => new Date(current),
      maxFailures: LOGIN_MAX_FAILURES,
      windowMs: LOGIN_WINDOW_MS,
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
  } satisfies AuthActionDependencies;

  return {
    deps,
    actions: createAuthActions(deps),
    advance(ms: number) {
      current += ms;
    },
  };
}

function phoneLogin(password: string, phone = MARIANA_PHONE) {
  return { method: LOGIN_METHOD.PHONE, phone, password };
}

describe("loginRateLimitKey", () => {
  it("prefixes the normalized identifier with the method", () => {
    expect(loginRateLimitKey({ method: LOGIN_METHOD.PHONE, phone: "5512345678", password: "x" })).toBe(
      "phone:5512345678",
    );
    expect(loginRateLimitKey({ method: LOGIN_METHOD.EMAIL, email: "mariana@spin.test", password: "x" })).toBe(
      "email:mariana@spin.test",
    );
  });

  it("throws for an unknown method", () => {
    const invalid = { method: "sms", password: "x" } as unknown as LoginCredentials;

    expect(() => loginRateLimitKey(invalid)).toThrow(/Unreachable case/);
  });
});

describe("AuthActions.login", () => {
  it("logs Mariana in with a formatted phone number", async () => {
    const { actions } = buildDeps();

    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe("Mariana López");
    }
  });

  it("logs Mariana in with an upper-case email", async () => {
    const { actions } = buildDeps();

    const result = await actions.login(
      { method: LOGIN_METHOD.EMAIL, email: "MARIANA@SPIN.TEST", password: MARIANA_PASSWORD },
      REQUEST_ID,
    );

    expect(result.ok).toBe(true);
  });

  it("returns validation for an empty password without touching the limiter", async () => {
    const { actions, deps } = buildDeps();
    const check = vi.spyOn(deps.rateLimiter, "check");

    const result = await actions.login(phoneLogin(""), REQUEST_ID);

    expect(result).toEqual({
      ok: false,
      error: { kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: { password: ["PASSWORD_REQUIRED"] } },
    });
    expect(check).not.toHaveBeenCalled();
  });

  it("returns validation for input that is not a login payload", async () => {
    const { actions } = buildDeps();

    const result = await actions.login(null, REQUEST_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(AUTH_FAILURE_KIND.VALIDATION);
    }
  });

  it.each([
    [LOGIN_METHOD.PHONE, phoneLogin(WRONG_PASSWORD)],
    [LOGIN_METHOD.EMAIL, { method: LOGIN_METHOD.EMAIL, email: "mariana@spin.test", password: WRONG_PASSWORD }],
  ])("returns invalid_credentials with the %s method", async (method, input) => {
    const { actions } = buildDeps();

    const result = await actions.login(input, REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.INVALID_CREDENTIALS, method } });
  });

  it("rejects the 6th attempt even with the right password, without verifying credentials", async () => {
    const { actions, deps } = buildDeps();
    const verify = vi.spyOn(deps.auth, "verifyCredentials");

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      await actions.login(phoneLogin(WRONG_PASSWORD), REQUEST_ID);
    }
    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.RATE_LIMITED, retryAfterMinutes: 15 } });
    expect(verify).toHaveBeenCalledTimes(LOGIN_MAX_FAILURES);
  });

  it("shares one counter across formatting variants of a phone", async () => {
    const { actions } = buildDeps();

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      await actions.login(phoneLogin(WRONG_PASSWORD, "5512345678"), REQUEST_ID);
    }
    const result = await actions.login(phoneLogin(MARIANA_PASSWORD, "+52 55 1234 5678"), REQUEST_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(AUTH_FAILURE_KIND.RATE_LIMITED);
    }
  });

  it("rounds the remaining wait up to whole minutes", async () => {
    const { actions, advance } = buildDeps();

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      await actions.login(phoneLogin(WRONG_PASSWORD), REQUEST_ID);
    }
    advance(10 * 60 * 1000 + 1);
    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.RATE_LIMITED, retryAfterMinutes: 5 } });
  });

  it("resets the counter after a successful login", async () => {
    const { actions } = buildDeps();

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES - 1; attempt += 1) {
      await actions.login(phoneLogin(WRONG_PASSWORD), REQUEST_ID);
    }
    await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);
    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES - 1; attempt += 1) {
      await actions.login(phoneLogin(WRONG_PASSWORD), REQUEST_ID);
    }
    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result.ok).toBe(true);
  });

  it("lets the same phone try again after 15 minutes", async () => {
    const { actions, advance } = buildDeps();

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      await actions.login(phoneLogin(WRONG_PASSWORD), REQUEST_ID);
    }
    advance(LOGIN_WINDOW_MS);
    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result.ok).toBe(true);
  });

  it("turns a thrown service error into unexpected and reports it once", async () => {
    const { actions, deps } = buildDeps();
    const failure = new Error("disk unavailable");
    vi.spyOn(deps.auth, "verifyCredentials").mockRejectedValue(failure);

    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: REQUEST_ID } });
    expect(deps.reporter.captureException).toHaveBeenCalledOnce();
    expect(deps.reporter.captureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ requestId: REQUEST_ID, source: ERROR_SOURCE.SERVER_ACTION }),
    );
  });

  it("treats a service error other than invalid credentials as unexpected", async () => {
    const { actions, deps } = buildDeps();
    vi.spyOn(deps.auth, "verifyCredentials").mockResolvedValue({ ok: false, error: { code: SERVICE_ERROR_CODE.NOT_FOUND } });

    const result = await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: REQUEST_ID } });
  });

  it("never logs the password or the identifier", async () => {
    const { actions, deps } = buildDeps();
    vi.spyOn(deps.auth, "verifyCredentials").mockRejectedValue(new Error("boom"));

    await actions.login(phoneLogin(MARIANA_PASSWORD), REQUEST_ID);
    await actions.login(phoneLogin(WRONG_PASSWORD), REQUEST_ID);

    const logged = JSON.stringify([
      deps.logger.info.mock.calls,
      deps.logger.warn.mock.calls,
      deps.logger.error.mock.calls,
    ]);
    expect(deps.logger.error).toHaveBeenCalled();
    expect(logged).not.toContain(MARIANA_PASSWORD);
    expect(logged).not.toContain(WRONG_PASSWORD);
    expect(logged).not.toContain("5512345678");
    expect(logged).not.toContain(MARIANA_PHONE);
  });
});

describe("AuthActions.register", () => {
  const NEW_USER = {
    fullName: "Nueva Usuaria",
    phone: "55 0000 0001",
    email: "nueva@spin.test",
    password: "Spin2026",
    passwordConfirmation: "Spin2026",
  };

  it("registers a new user", async () => {
    const { actions } = buildDeps();

    const result = await actions.register(NEW_USER, REQUEST_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe("Nueva Usuaria");
    }
  });

  it("returns PHONE_ALREADY_REGISTERED as validation", async () => {
    const { actions } = buildDeps();

    const result = await actions.register({ ...NEW_USER, phone: MARIANA_PHONE }, REQUEST_ID);

    expect(result).toEqual({
      ok: false,
      error: { kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: { phone: ["PHONE_ALREADY_REGISTERED"] } },
    });
  });

  it("returns PASSWORD_MISMATCH on passwordConfirmation", async () => {
    const { actions } = buildDeps();

    const result = await actions.register({ ...NEW_USER, passwordConfirmation: "Spin2027" }, REQUEST_ID);

    expect(result).toEqual({
      ok: false,
      error: { kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: { passwordConfirmation: ["PASSWORD_MISMATCH"] } },
    });
  });

  it("turns a thrown service error into unexpected and reports it once", async () => {
    const { actions, deps } = buildDeps();
    vi.spyOn(deps.auth, "register").mockRejectedValue(new Error("disk unavailable"));

    const result = await actions.register(NEW_USER, REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: REQUEST_ID } });
    expect(deps.reporter.captureException).toHaveBeenCalledOnce();
    expect(deps.reporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ requestId: REQUEST_ID, source: ERROR_SOURCE.SERVER_ACTION }),
    );
  });

  it("treats a service error other than validation as unexpected", async () => {
    const { actions, deps } = buildDeps();
    vi.spyOn(deps.auth, "register").mockResolvedValue({ ok: false, error: { code: SERVICE_ERROR_CODE.NOT_FOUND } });

    const result = await actions.register(NEW_USER, REQUEST_ID);

    expect(result).toEqual({ ok: false, error: { kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: REQUEST_ID } });
  });
});
