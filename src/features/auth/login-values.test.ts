import { describe, expect, it } from "vitest";
import { LOGIN_METHOD } from "@/domain/user/schemas";
import { loginFieldsSchema, toLoginInput, type LoginFields } from "./login-values";

const FIELDS = { phone: "55 1234 5678", email: "mariana@spin.test", password: "Spin2026" };

describe("toLoginInput", () => {
  it("keeps only the phone for the phone method", () => {
    expect(toLoginInput({ ...FIELDS, method: LOGIN_METHOD.PHONE })).toEqual({
      method: LOGIN_METHOD.PHONE,
      phone: FIELDS.phone,
      password: FIELDS.password,
    });
  });

  it("keeps only the email for the email method", () => {
    expect(toLoginInput({ ...FIELDS, method: LOGIN_METHOD.EMAIL })).toEqual({
      method: LOGIN_METHOD.EMAIL,
      email: FIELDS.email,
      password: FIELDS.password,
    });
  });

  it("throws for an unknown method", () => {
    const invalid = { ...FIELDS, method: "sms" } as unknown as LoginFields;

    expect(() => toLoginInput(invalid)).toThrow(/Unreachable case/);
  });
});

describe("loginFieldsSchema", () => {
  function issuesOf(fields: LoginFields) {
    const result = loginFieldsSchema.safeParse(fields);

    return result.success ? [] : result.error.issues.map((issue) => [issue.path.join("."), issue.message]);
  }

  it("accepts valid phone credentials", () => {
    expect(issuesOf({ ...FIELDS, method: LOGIN_METHOD.PHONE })).toEqual([]);
  });

  it("reports the domain code on the phone field for the phone method", () => {
    expect(issuesOf({ ...FIELDS, method: LOGIN_METHOD.PHONE, phone: "55 12" })).toEqual([
      ["phone", "PHONE_INVALID_LENGTH"],
    ]);
  });

  it("ignores the phone field for the email method", () => {
    expect(issuesOf({ ...FIELDS, method: LOGIN_METHOD.EMAIL, phone: "55 12" })).toEqual([]);
  });

  it("reports the domain code on the email field for the email method", () => {
    expect(issuesOf({ ...FIELDS, method: LOGIN_METHOD.EMAIL, email: "mariana" })).toEqual([
      ["email", "EMAIL_INVALID_FORMAT"],
    ]);
  });
});
