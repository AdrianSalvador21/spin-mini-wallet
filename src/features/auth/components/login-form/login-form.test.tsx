import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_METHOD } from "@/domain/user/schemas";
import { AUTH_FAILURE_KIND, AUTH_FORM_STATUS, type AuthFormState } from "@/shared/lib/auth/form-state";
import { INPUT_TYPE } from "@/shared/ui/field/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({ loginAction: vi.fn() }));

vi.mock("../../actions", () => ({ loginAction: mocks.loginAction }));

const PHONE_LABEL = "Número celular";
const PASSWORD_LABEL = "Contraseña";

function errorState(failure: Extract<AuthFormState, { status: "error" }>["failure"]): AuthFormState {
  return { status: AUTH_FORM_STATUS.ERROR, failure };
}

async function submitPhoneLogin() {
  await userEvent.type(screen.getByLabelText(PHONE_LABEL), "5512345678");
  await userEvent.type(screen.getByLabelText(PASSWORD_LABEL), "Spin2026");
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

beforeEach(() => {
  mocks.loginAction.mockReset();
});

describe("LoginForm", () => {
  it("defaults to the phone field with the +52 prefix and the mask", async () => {
    renderWithProviders(<LoginForm />);

    const phone = screen.getByLabelText(PHONE_LABEL);
    await userEvent.type(phone, "5512345678");

    expect(phone).toHaveAttribute("type", INPUT_TYPE.TEL);
    expect(screen.getByText("+52")).toBeInTheDocument();
    expect(phone).toHaveValue("55 1234 5678");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("switches to email, clearing the identifier, keeping the password and moving focus", async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText(PHONE_LABEL), "5512345678");
    await userEvent.type(screen.getByLabelText(PASSWORD_LABEL), "Spin2026");

    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión con email" }));

    const email = screen.getByLabelText("Email");
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveValue("");
    expect(screen.queryByLabelText(PHONE_LABEL)).not.toBeInTheDocument();
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveValue("Spin2026");

    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión con celular" }));

    const phone = screen.getByLabelText(PHONE_LABEL);
    await waitFor(() => expect(phone).toHaveFocus());
    expect(phone).toHaveValue("");
  });

  it("shows inline errors on an empty submit without calling the action", async () => {
    renderWithProviders(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Escribe tu número celular.")).toBeInTheDocument();
    expect(screen.getByText("Escribe tu contraseña.")).toBeInTheDocument();
    expect(screen.getByLabelText(PHONE_LABEL)).toHaveAttribute("aria-invalid", "true");
    expect(mocks.loginAction).not.toHaveBeenCalled();
  });

  it("sends the raw form values to the action", async () => {
    mocks.loginAction.mockResolvedValue({ status: AUTH_FORM_STATUS.IDLE });
    renderWithProviders(<LoginForm />);

    await submitPhoneLogin();

    await waitFor(() =>
      expect(mocks.loginAction).toHaveBeenCalledWith(
        { status: AUTH_FORM_STATUS.IDLE },
        { method: LOGIN_METHOD.PHONE, phone: "55 1234 5678", password: "Spin2026" },
      ),
    );
  });

  it("shows the loading state while the action is pending", async () => {
    const pending = Promise.withResolvers<AuthFormState>();
    mocks.loginAction.mockReturnValue(pending.promise);
    renderWithProviders(<LoginForm />);

    await submitPhoneLogin();

    const button = await screen.findByRole("button", { name: "Iniciando sesión…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    pending.resolve({ status: AUTH_FORM_STATUS.IDLE });
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  });

  it.each([
    [
      errorState({ kind: AUTH_FAILURE_KIND.INVALID_CREDENTIALS, method: LOGIN_METHOD.PHONE }),
      "El celular o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo.",
    ],
    [
      errorState({ kind: AUTH_FAILURE_KIND.RATE_LIMITED, retryAfterMinutes: 3 }),
      "Demasiados intentos. Espera 3 minutos e inténtalo de nuevo.",
    ],
    [errorState({ kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: "req-42" }), "Referencia: req-42"],
  ])("shows a server failure in an alert", async (state, text) => {
    mocks.loginAction.mockResolvedValue(state);
    renderWithProviders(<LoginForm />);

    await submitPhoneLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("shows server validation errors on their fields", async () => {
    mocks.loginAction.mockResolvedValue(
      errorState({ kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: { phone: ["PHONE_INVALID_LENGTH"], method: [] } }),
    );
    renderWithProviders(<LoginForm />);

    await submitPhoneLogin();

    expect(await screen.findByText("Escribe un número celular de 10 dígitos.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the server error when the method changes", async () => {
    mocks.loginAction.mockResolvedValue(
      errorState({ kind: AUTH_FAILURE_KIND.INVALID_CREDENTIALS, method: LOGIN_METHOD.PHONE }),
    );
    renderWithProviders(<LoginForm />);
    await submitPhoneLogin();
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión con email" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
