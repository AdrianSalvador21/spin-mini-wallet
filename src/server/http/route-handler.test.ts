import "server-only";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/domain/user/types";
import { ERROR_SOURCE } from "@/shared/observability/error-reporter";
import type { HttpDependencies } from "./route-handler";

const ORIGINAL_ENV = process.env;
const SECRET = "a".repeat(32);

interface MockCookie {
  name: string;
  value: string;
}

function createCookieStore(initial?: MockCookie) {
  const store = new Map<string, string>();

  if (initial) {
    store.set(initial.name, initial.value);
  }

  return {
    get: vi.fn((name: string) => (store.has(name) ? { name, value: store.get(name) as string } : undefined)),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
  };
}

let mockCookieStore: ReturnType<typeof createCookieStore>;

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

beforeEach(() => {
  mockCookieStore = createCookieStore();
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: SECRET };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.resetModules();
});

function buildDeps(overrides: Partial<HttpDependencies> = {}): HttpDependencies {
  return {
    services: {} as HttpDependencies["services"],
    random: () => 0,
    sleep: async () => {},
    createRequestId: () => "generated-id",
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
    allowScenarioOverride: false,
    ...overrides,
  };
}

function buildGetRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://smw.test/api/v1/wallet/summary", { headers });
}

function buildMutatingRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://smw.test/api/v1/transfers", { method: "POST", headers });
}

async function signIn(): Promise<void> {
  const { setSessionCookie } = await import("../session/session");
  await setSessionCookie("usr_1" as UserId);
}

describe("createRouteHandler", () => {
  it("reuses an incoming x-request-id", async () => {
    const { createRouteHandler } = await import("./route-handler");
    await signIn();

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async (ctx) => Response.json({ requestId: ctx.requestId }));

    const response = await handler(buildGetRequest({ "x-request-id": "incoming-id" }), {
      params: Promise.resolve({}),
    });

    expect(response.headers.get("x-request-id")).toBe("incoming-id");
    expect(await response.json()).toEqual({ requestId: "incoming-id" });
  });

  it("generates a request id when it is missing", async () => {
    const { createRouteHandler } = await import("./route-handler");
    await signIn();

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async () => Response.json({ ok: true }));

    const response = await handler(buildGetRequest(), { params: Promise.resolve({}) });

    expect(response.headers.get("x-request-id")).toBe("generated-id");
  });

  it("answers 401 UNAUTHORIZED when there is no session", async () => {
    const { createRouteHandler } = await import("./route-handler");

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async () => Response.json({ ok: true }));

    const response = await handler(buildGetRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("answers 415 FORBIDDEN for a wrong Content-Type on a mutating route, before the session check", async () => {
    const { createRouteHandler } = await import("./route-handler");

    const deps = buildDeps();
    const handler = createRouteHandler(deps, { mutating: true }, async () => Response.json({ ok: true }));

    const response = await handler(
      buildMutatingRequest({ "content-type": "text/plain", origin: "https://smw.test", host: "smw.test" }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("answers 403 FORBIDDEN for a bad Origin on a mutating route, before the session check", async () => {
    const { createRouteHandler } = await import("./route-handler");

    const deps = buildDeps();
    const handler = createRouteHandler(deps, { mutating: true }, async () => Response.json({ ok: true }));

    const response = await handler(
      buildMutatingRequest({
        "content-type": "application/json",
        origin: "https://evil.test",
        host: "smw.test",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("answers 500 INTERNAL_ERROR and reports the error when the handler throws", async () => {
    const { createRouteHandler } = await import("./route-handler");
    await signIn();

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async () => {
      throw new Error("boom");
    });

    const response = await handler(buildGetRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
    expect(deps.reporter.captureException).toHaveBeenCalledTimes(1);
    expect(deps.reporter.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: ERROR_SOURCE.ROUTE_HANDLER, requestId: "generated-id" }),
    );
  });

  it("sets x-request-id and Cache-Control: no-store on every response", async () => {
    const { createRouteHandler } = await import("./route-handler");
    await signIn();

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async () => Response.json({ ok: true }));

    const response = await handler(buildGetRequest(), { params: Promise.resolve({}) });

    expect(response.headers.get("x-request-id")).toBe("generated-id");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("writes an access log line with no body and no PII", async () => {
    const { createRouteHandler } = await import("./route-handler");
    await signIn();

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async () =>
      Response.json({ email: "a@b.mx", password: "secret" }),
    );

    await handler(buildGetRequest(), { params: Promise.resolve({}) });

    expect(deps.logger.info).toHaveBeenCalledTimes(1);
    const [message, fields] = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toBe("api_request");
    expect(JSON.stringify(fields)).not.toContain("a@b.mx");
    expect(JSON.stringify(fields)).not.toContain("secret");
    expect(fields).toMatchObject({ method: "GET", status: 200 });
    expect(typeof fields.durationMs).toBe("number");
  });

  it("includes the reported scenario in the access log line", async () => {
    const { createRouteHandler } = await import("./route-handler");
    await signIn();

    const deps = buildDeps();
    const handler = createRouteHandler(deps, {}, async (ctx) => {
      ctx.reportScenario("network_error");
      return Response.json({ ok: true });
    });

    await handler(buildGetRequest(), { params: Promise.resolve({}) });

    const [, fields] = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fields.scenario).toBe("network_error");
  });
});
