import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { INPUT_TYPE } from "@/shared/ui/field/types";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("starts hidden with a show toggle that is not pressed", () => {
    renderWithProviders(<PasswordInput id="password" label="Contraseña" />);

    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", INPUT_TYPE.PASSWORD);
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles between password and text, updating its label and pressed state", async () => {
    renderWithProviders(<PasswordInput id="password" label="Contraseña" />);

    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));

    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", INPUT_TYPE.TEXT);
    const hide = screen.getByRole("button", { name: "Ocultar contraseña" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(hide);

    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", INPUT_TYPE.PASSWORD);
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not submit the surrounding form when toggled", async () => {
    let submitted = false;
    renderWithProviders(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <PasswordInput id="password" label="Contraseña" />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));

    expect(submitted).toBe(false);
  });

  it("passes the error and the ref through to the field", () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProviders(
      <PasswordInput id="password" label="Contraseña" error="Escribe tu contraseña." ref={ref} />,
    );

    const input = screen.getByLabelText("Contraseña");

    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Escribe tu contraseña.");
  });
});
