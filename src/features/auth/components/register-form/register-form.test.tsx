import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_FAILURE_KIND, AUTH_FORM_STATUS, type AuthFormState } from "@/shared/lib/auth/form-state";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { RegisterForm } from "./register-form";

const mocks = vi.hoisted(() => ({ registerAction: vi.fn() }));

vi.mock("../../actions", () => ({ registerAction: mocks.registerAction }));

const FORM_TEST_TIMEOUT_MS = 20_000;

const VALUES = {
  fullName: "Nueva Usuaria",
  phone: "5500000001",
  email: "nueva@spin.test",
  password: "Spin2026",
};

async function fillForm(passwordConfirmation = VALUES.password) {
  await userEvent.type(screen.getByLabelText("Nombre completo"), VALUES.fullName);
  await userEvent.type(screen.getByLabelText("Número celular"), VALUES.phone);
  await userEvent.type(screen.getByLabelText("Email"), VALUES.email);
  await userEvent.type(screen.getByLabelText("Contraseña"), VALUES.password);
  await userEvent.type(screen.getByLabelText("Confirma tu contraseña"), passwordConfirmation);
}

beforeEach(() => {
  mocks.registerAction.mockReset();
});

describe("RegisterForm", { timeout: FORM_TEST_TIMEOUT_MS }, () => {
  it("describes the password field with the policy hint", () => {
    renderWithProviders(<RegisterForm />);

    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      "Mínimo 8 caracteres, una mayúscula y un número.",
    );
  });

  it("masks the phone and sends the raw values to the action", async () => {
    mocks.registerAction.mockResolvedValue({ status: AUTH_FORM_STATUS.IDLE });
    renderWithProviders(<RegisterForm />);

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByLabelText("Número celular")).toHaveValue("55 0000 0001");
    await waitFor(() =>
      expect(mocks.registerAction).toHaveBeenCalledWith(
        { status: AUTH_FORM_STATUS.IDLE },
        { ...VALUES, phone: "55 0000 0001", passwordConfirmation: VALUES.password },
      ),
    );
  });

  it("shows PASSWORD_MISMATCH inline without calling the action", async () => {
    renderWithProviders(<RegisterForm />);

    await fillForm("Spin2027");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirma tu contraseña")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.registerAction).not.toHaveBeenCalled();
  });

  it("shows a server PHONE_ALREADY_REGISTERED on the phone field", async () => {
    const state: AuthFormState = {
      status: AUTH_FORM_STATUS.ERROR,
      failure: { kind: AUTH_FAILURE_KIND.VALIDATION, fieldErrors: { phone: ["PHONE_ALREADY_REGISTERED"], form: [] } },
    };
    mocks.registerAction.mockResolvedValue(state);
    renderWithProviders(<RegisterForm />);

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Este número celular ya tiene una cuenta. Inicia sesión.")).toBeInTheDocument();
    expect(screen.getByLabelText("Número celular")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an unexpected failure with its reference", async () => {
    mocks.registerAction.mockResolvedValue({
      status: AUTH_FORM_STATUS.ERROR,
      failure: { kind: AUTH_FAILURE_KIND.UNEXPECTED, requestId: "req-9" },
    });
    renderWithProviders(<RegisterForm />);

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Referencia: req-9");
  });

  it("shows the loading state while the action is pending", async () => {
    const pending = Promise.withResolvers<AuthFormState>();
    mocks.registerAction.mockReturnValue(pending.promise);
    renderWithProviders(<RegisterForm />);

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const button = await screen.findByRole("button", { name: "Creando cuenta…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    pending.resolve({ status: AUTH_FORM_STATUS.IDLE });
    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeEnabled();
  });
});
