import { z } from "zod";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { LOGIN_METHOD, loginSchema } from "@/domain/user/schemas";
import type { LoginFormValues, LoginMethod } from "@/shared/lib/auth/form-state";

export interface LoginFields {
  method: LoginMethod;
  phone: string;
  email: string;
  password: string;
}

export function toLoginInput(fields: LoginFields): LoginFormValues {
  switch (fields.method) {
    case LOGIN_METHOD.PHONE:
      return { method: fields.method, phone: fields.phone, password: fields.password };
    case LOGIN_METHOD.EMAIL:
      return { method: fields.method, email: fields.email, password: fields.password };
    default:
      return assertUnreachable(fields.method);
  }
}

export const loginFieldsSchema = z
  .object({
    method: z.enum([LOGIN_METHOD.PHONE, LOGIN_METHOD.EMAIL]),
    phone: z.string(),
    email: z.string(),
    password: z.string(),
  })
  .superRefine((fields, ctx) => {
    const result = loginSchema.safeParse(toLoginInput(fields));

    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
      }
    }
  });
