"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Result } from "@/domain/shared/result";
import { getAuthActions } from "@/server/container";
import type { UserView } from "@/server/services/views";
import { clearSessionCookie, setSessionCookie } from "@/server/session/session";
import { REQUEST_ID_HEADER } from "@/shared/lib/api/contract";
import {
  AUTH_FORM_STATUS,
  type AuthFailure,
  type AuthFormState,
  type LoginFormValues,
  type RegisterFormValues,
} from "@/shared/lib/auth/form-state";
import { ROUTES } from "@/shared/lib/routes";

async function currentRequestId(): Promise<string> {
  const headerStore = await headers();

  return headerStore.get(REQUEST_ID_HEADER) ?? randomUUID();
}

async function signInOrFail(result: Result<UserView, AuthFailure>): Promise<AuthFormState> {
  if (!result.ok) {
    return { status: AUTH_FORM_STATUS.ERROR, failure: result.error };
  }

  await setSessionCookie(result.value.id);
  redirect(ROUTES.HOME);
}

export async function loginAction(_previous: AuthFormState, input: LoginFormValues): Promise<AuthFormState> {
  const result = await getAuthActions().login(input, await currentRequestId());

  return signInOrFail(result);
}

export async function registerAction(_previous: AuthFormState, input: RegisterFormValues): Promise<AuthFormState> {
  const result = await getAuthActions().register(input, await currentRequestId());

  return signInOrFail(result);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect(ROUTES.LOGIN);
}
