import { describe, expect, it } from "vitest";
import { LOGIN_METHOD, loginSchema, registerSchema } from "./schemas";

describe("registerSchema", () => {
  it("outputs normalized values on success", () => {
    const result = registerSchema.safeParse({
      fullName: "  Mariana   Pérez  ",
      phone: "+52 (55) 1234-5678",
      email: "  Mariana@Spin.TEST ",
      password: "Spin2026",
      passwordConfirmation: "Spin2026",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      fullName: "Mariana Pérez",
      phone: "5512345678",
      email: "mariana@spin.test",
      password: "Spin2026",
      passwordConfirmation: "Spin2026",
    });
  });

  it("reports PASSWORD_MISMATCH on passwordConfirmation when passwords differ", () => {
    const result = registerSchema.safeParse({
      fullName: "Mariana Pérez",
      phone: "5512345678",
      email: "mariana@spin.test",
      password: "Spin2026",
      passwordConfirmation: "Other2026",
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.join(".") === "passwordConfirmation");
    expect(issue?.message).toBe("PASSWORD_MISMATCH");
  });

  it("reports the underlying validator code for an invalid field", () => {
    const result = registerSchema.safeParse({
      fullName: "Mariana Pérez",
      phone: "55 1234 567",
      email: "mariana@spin.test",
      password: "Spin2026",
      passwordConfirmation: "Spin2026",
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.join(".") === "phone");
    expect(issue?.message).toBe("PHONE_INVALID_LENGTH");
  });
});

describe("loginSchema", () => {
  it("accepts the phone method with a normalized phone", () => {
    const result = loginSchema.safeParse({
      method: LOGIN_METHOD.PHONE,
      phone: "+52 (55) 1234-5678",
      password: "x",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ method: "phone", phone: "5512345678", password: "x" });
  });

  it("accepts the email method without applying the password policy", () => {
    const result = loginSchema.safeParse({
      method: LOGIN_METHOD.EMAIL,
      email: "mariana@spin.test",
      password: "x",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ method: "email", email: "mariana@spin.test", password: "x" });
  });

  it("returns PASSWORD_REQUIRED for an empty password", () => {
    const result = loginSchema.safeParse({
      method: LOGIN_METHOD.EMAIL,
      email: "mariana@spin.test",
      password: "",
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.join(".") === "password");
    expect(issue?.message).toBe("PASSWORD_REQUIRED");
  });
});
