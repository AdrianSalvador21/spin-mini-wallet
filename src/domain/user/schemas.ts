import { z } from "zod";
import { fromValidator } from "../shared/validation";
import { validateEmail, validateFullName, validatePassword, validatePhone } from "./validators";

export const LOGIN_METHOD = {
  PHONE: "phone",
  EMAIL: "email",
} as const;

const fullNameSchema = fromValidator(validateFullName);
const phoneSchema = fromValidator(validatePhone);
const emailSchema = fromValidator(validateEmail);
const passwordSchema = fromValidator(validatePassword);

const requiredPasswordSchema = z.string().transform((value, ctx) => {
  if (value.length === 0) {
    ctx.addIssue({ code: "custom", message: "PASSWORD_REQUIRED" });
    return z.NEVER;
  }

  return value;
});

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    phone: phoneSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirmation) {
      ctx.addIssue({ code: "custom", message: "PASSWORD_MISMATCH", path: ["passwordConfirmation"] });
    }
  });

export const loginSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal(LOGIN_METHOD.PHONE),
    phone: phoneSchema,
    password: requiredPasswordSchema,
  }),
  z.object({
    method: z.literal(LOGIN_METHOD.EMAIL),
    email: emailSchema,
    password: requiredPasswordSchema,
  }),
]);
