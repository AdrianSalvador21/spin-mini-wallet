import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Field } from "./field";
import { INPUT_TYPE } from "./types";

describe("Field", () => {
  it("associates the label with the input", () => {
    renderWithProviders(<Field id="email" label="Email" />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email");
  });

  it("defaults to a text input and keeps an explicit type", () => {
    renderWithProviders(
      <>
        <Field id="name" label="Nombre" />
        <Field id="email" label="Email" type={INPUT_TYPE.EMAIL} />
      </>,
    );

    expect(screen.getByLabelText("Nombre")).toHaveAttribute("type", INPUT_TYPE.TEXT);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", INPUT_TYPE.EMAIL);
  });

  it("renders the prefix", () => {
    renderWithProviders(<Field id="phone" label="Número celular" prefix="+52" />);

    expect(screen.getByText("+52")).toBeInTheDocument();
  });

  it("marks the input invalid and describes it with the error", () => {
    renderWithProviders(<Field id="phone" label="Número celular" hint="10 dígitos" error="Escribe tu número celular." />);

    const input = screen.getByLabelText("Número celular");
    const error = screen.getByText("Escribe tu número celular.");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(input).toHaveAccessibleDescription("Escribe tu número celular.");
    expect(screen.queryByText("10 dígitos")).not.toBeInTheDocument();
  });

  it("describes the input with the hint when there is no error", () => {
    renderWithProviders(<Field id="password" label="Contraseña" hint="Mínimo 8 caracteres." />);

    const input = screen.getByLabelText("Contraseña");

    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Mínimo 8 caracteres.");
  });

  it("has no description without a hint or an error", () => {
    renderWithProviders(<Field id="name" label="Nombre" />);

    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-describedby");
  });

  it("forwards the ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProviders(<Field id="name" label="Nombre" ref={ref} />);

    expect(ref.current).toBe(screen.getByLabelText("Nombre"));
  });
});
