import "server-only";
import type { z } from "zod";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { err, ok, type Result } from "@/domain/shared/result";
import { toFieldErrors } from "@/domain/shared/validation";
import { LOGIN_METHOD, loginSchema, registerSchema } from "@/domain/user/schemas";
import { AUTH_FAILURE_KIND, type AuthFailure } from "@/shared/lib/auth/form-state";
import { ERROR_SOURCE, type ErrorReporter } from "@/shared/observability/error-reporter";
import type { Logger } from "@/shared/observability/logger";
import type { AuthService } from "../services/auth-service";
import { SERVICE_ERROR_CODE } from "../services/types";
import type { UserView } from "../services/views";
import type { LoginRateLimiter } from "./login-rate-limiter";

export interface AuthActionDependencies {
  auth: AuthService;
  rateLimiter: LoginRateLimiter;
  logger: Logger;
  reporter: ErrorReporter;
}

export interface AuthActions {
  login(input: unknown, requestId: string): Promise<Result<UserView, AuthFailure>>;
  register(input: unknown, requestId: string): Promise<Result<UserView, AuthFailure>>;
}

export const AUTH_ACTION = {
  LOGIN: "login",
  REGISTER: "register",
} as const;

type AuthAction = (typeof AUTH_ACTION)[keyof typeof AUTH_ACTION];

const MINUTE_MS = 60 * 1000;

export type LoginCredentials = z.infer<typeof loginSchema>;

export function loginRateLimitKey(credentials: LoginCredentials): string {
  switch (credentials.method) {
    case LOGIN_METHOD.PHONE:
      return `${credentials.method}:${credentials.phone}`;
    case LOGIN_METHOD.EMAIL:
      return `${credentials.method}:${credentials.email}`;
    default:
      return assertUnreachable(credentials);
  }
}

export function createAuthActions({ auth, rateLimiter, logger, reporter }: AuthActionDependencies): AuthActions {
  async function guard(
    action: AuthAction,
    requestId: string,
    run: () => Promise<Result<UserView, AuthFailure>>,
  ): Promise<Result<UserView, AuthFailure>> {
    try {
      return await run();
    } catch (error) {
      logger.error("server_action_error", { requestId, action });
      reporter.captureException(error, { requestId, source: ERROR_SOURCE.SERVER_ACTION, action });

      return err({ kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId });
    }
  }

  return {
    login(input, requestId) {
      return guard(AUTH_ACTION.LOGIN, requestId, async () => {
        const parsed = loginSchema.safeParse(input);

        if (!parsed.success) {
          return err({ kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: toFieldErrors(parsed.error) });
        }

        const key = loginRateLimitKey(parsed.data);
        const limit = rateLimiter.check(key);

        if (!limit.allowed) {
          return err({ kind: AUTH_FAILURE_KIND.RATE_LIMITED, retryAfterMinutes: Math.ceil(limit.retryAfterMs / MINUTE_MS) });
        }

        const result = await auth.verifyCredentials(parsed.data);

        if (!result.ok) {
          if (result.error.code !== SERVICE_ERROR_CODE.INVALID_CREDENTIALS) {
            throw new Error(`Unexpected login service error: ${result.error.code}`);
          }

          rateLimiter.recordFailure(key);

          return err({ kind: AUTH_FAILURE_KIND.INVALID_CREDENTIALS, method: parsed.data.method });
        }

        rateLimiter.reset(key);

        return ok(result.value);
      });
    },

    register(input, requestId) {
      return guard(AUTH_ACTION.REGISTER, requestId, async () => {
        const parsed = registerSchema.safeParse(input);

        if (!parsed.success) {
          return err({ kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: toFieldErrors(parsed.error) });
        }

        const result = await auth.register(parsed.data);

        if (!result.ok) {
          if (result.error.code !== SERVICE_ERROR_CODE.VALIDATION_ERROR) {
            throw new Error(`Unexpected register service error: ${result.error.code}`);
          }

          return err({ kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: result.error.details });
        }

        return ok(result.value);
      });
    },
  };
}
