import "server-only";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/domain/user/types";

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

describe("getSession", () => {
  it("returns null when there is no session cookie", async () => {
    const { getSession } = await import("./session");

    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered cookie", async () => {
    mockCookieStore = createCookieStore({ name: "smw_session", value: "not-a-token" });

    const { getSession } = await import("./session");

    expect(await getSession()).toBeNull();
  });

  it("returns null for an expired cookie", async () => {
    const { signSessionToken } = await import("./token");
    const expiredPayload = {
      userId: "usr_1" as UserId,
      issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    mockCookieStore = createCookieStore({
      name: "smw_session",
      value: signSessionToken(expiredPayload, SECRET),
    });

    const { getSession } = await import("./session");

    expect(await getSession()).toBeNull();
  });

  it("returns the payload for a valid cookie", async () => {
    const { setSessionCookie } = await import("./session");
    await setSessionCookie("usr_1" as UserId);

    const { getSession } = await import("./session");
    const session = await getSession();

    expect(session?.userId).toBe("usr_1");
  });
});

describe("requireSession", () => {
  it("throws UnauthorizedError when there is no valid session", async () => {
    const { requireSession } = await import("./session");
    const { UnauthorizedError } = await import("../errors");

    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
  });

  it("returns the payload when the session is valid", async () => {
    const { setSessionCookie, requireSession } = await import("./session");
    await setSessionCookie("usr_1" as UserId);

    expect((await requireSession()).userId).toBe("usr_1");
  });
});

describe("setSessionCookie", () => {
  it("writes the cookie with the documented options", async () => {
    const { setSessionCookie } = await import("./session");

    await setSessionCookie("usr_1" as UserId);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "smw_session",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 1800,
      }),
    );
  });
});

describe("clearSessionCookie", () => {
  it("deletes the session cookie", async () => {
    const { clearSessionCookie } = await import("./session");

    await clearSessionCookie();

    expect(mockCookieStore.delete).toHaveBeenCalledWith("smw_session");
  });
});
