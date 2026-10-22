import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/shared/result";
import { LOGIN_METHOD } from "@/domain/user/schemas";
import type { UserId } from "@/domain/user/types";
import { REQUEST_ID_HEADER } from "@/shared/lib/api/contract";
import { AUTH_FAILURE_KIND, AUTH_FORM_STATUS, type AuthFormState } from "@/shared/lib/auth/form-state";
import { ROUTES } from "@/shared/lib/routes";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/container", () => ({
  getAuthActions: () => ({ login: mocks.login, register: mocks.register }),
}));
vi.mock("@/server/session/session", () => ({
  setSessionCookie: mocks.setSessionCookie,
  clearSessionCookie: mocks.clearSessionCookie,
}));

const { loginAction, logoutAction, registerAction } = await import("./actions");

const IDLE: AuthFormState = { status: AUTH_FORM_STATUS.IDLE };
const REQUEST_ID = "req-action-1";
const USER = { id: "usr_1" as UserId, fullName: "Mariana López", phone: "5512345678", email: "mariana@spin.test" };
const LOGIN_INPUT = { method: LOGIN_METHOD.PHONE, phone: "55 1234 5678", password: "Spin2026" };
const REGISTER_INPUT = {
  fullName: "Nueva Usuaria",
  phone: "55 0000 0001",
  email: "nueva@spin.test",
  password: "Spin2026",
  passwordConfirmation: "Spin2026",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ [REQUEST_ID_HEADER]: REQUEST_ID }));
});

describe("loginAction", () => {
  it("sets the session cookie and redirects home on success", async () => {
    mocks.login.mockResolvedValue(ok(USER));

    await expect(loginAction(IDLE, LOGIN_INPUT)).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.HOME}`);

    expect(mocks.login).toHaveBeenCalledWith(LOGIN_INPUT, REQUEST_ID);
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(USER.id);
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it("returns the failure without a cookie or a redirect", async () => {
    const failure = { kind: AUTH_FAILURE_KIND.INVALID_CREDENTIALS, method: LOGIN_METHOD.PHONE } as const;
    mocks.login.mockResolvedValue(err(failure));

    const state = await loginAction(IDLE, LOGIN_INPUT);

    expect(state).toEqual({ status: AUTH_FORM_STATUS.ERROR, failure });
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("generates a request id when the header is missing", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    mocks.login.mockResolvedValue(err({ kind: AUTH_FAILURE_KIND.RATE_LIMITED, retryAfterMinutes: 3 }));

    await loginAction(IDLE, LOGIN_INPUT);

    expect(mocks.login).toHaveBeenCalledWith(LOGIN_INPUT, expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
});

describe("registerAction", () => {
  it("signs the new user in and redirects home on success", async () => {
    mocks.register.mockResolvedValue(ok(USER));

    await expect(registerAction(IDLE, REGISTER_INPUT)).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.HOME}`);

    expect(mocks.register).toHaveBeenCalledWith(REGISTER_INPUT, REQUEST_ID);
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(USER.id);
  });

  it("returns the failure without a cookie or a redirect", async () => {
    const failure = {
      kind: AUTH_FAILURE_KIND.VALIDATION,
      fieldErrors: { phone: ["PHONE_ALREADY_REGISTERED" as const] },
    };
    mocks.register.mockResolvedValue(err(failure));

    const state = await registerAction(IDLE, REGISTER_INPUT);

    expect(state).toEqual({ status: AUTH_FORM_STATUS.ERROR, failure });
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  it("clears the session cookie and redirects to login", async () => {
    await expect(logoutAction()).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.LOGIN}`);

    expect(mocks.clearSessionCookie).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.LOGIN);
  });
});
