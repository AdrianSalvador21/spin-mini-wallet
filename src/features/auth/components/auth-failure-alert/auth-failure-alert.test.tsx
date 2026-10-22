import { describe, expect, it, vi } from "vitest";
import { LOGIN_METHOD } from "@/domain/user/schemas";
import { AUTH_FAILURE_KIND, type AuthFailure } from "@/shared/lib/auth/form-state";
import { renderWithProviders, screen } from "@/test/render";
import { AuthFailureAlert } from "./auth-failure-alert";

describe("AuthFailureAlert", () => {
  it("renders nothing for a validation failure", () => {
    const { container } = renderWithProviders(
      <AuthFailureAlert failure={{ kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: {} }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [LOGIN_METHOD.PHONE, "El celular o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo."],
    [LOGIN_METHOD.EMAIL, "El email o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo."],
  ])("names the %s method on invalid credentials", (method, text) => {
    renderWithProviders(<AuthFailureAlert failure={{ kind: AUTH_FAILURE_KIND.INVALID_CREDENTIALS, method }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(text);
  });

  it("uses the singular for one minute of wait", () => {
    renderWithProviders(<AuthFailureAlert failure={{ kind: AUTH_FAILURE_KIND.RATE_LIMITED, retryAfterMinutes: 1 }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Demasiados intentos. Espera 1 minuto e inténtalo de nuevo.");
  });

  it("shows the reference for an unexpected failure", () => {
    renderWithProviders(<AuthFailureAlert failure={{ kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: "req-7" }} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Algo salió mal. Intenta más tarde.");
    expect(alert).toHaveTextContent("Referencia: req-7");
  });

  it("throws for an unknown kind", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const invalid = { kind: "offline" } as unknown as AuthFailure;

    expect(() => renderWithProviders(<AuthFailureAlert failure={invalid} />)).toThrow(/Unreachable case/);

    consoleError.mockRestore();
  });
});
