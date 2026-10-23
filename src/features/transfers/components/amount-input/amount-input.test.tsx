import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { AmountInput } from "./amount-input";

function ControlledAmount({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);

  return <AmountInput id="amount" label="¿Cuánto quieres enviar?" value={value} onChange={setValue} hint="Disponible" />;
}

function input() {
  return screen.getByLabelText<HTMLInputElement>("¿Cuánto quieres enviar?");
}

describe("AmountInput", () => {
  it("is a labeled decimal text input", () => {
    renderWithProviders(<ControlledAmount />);

    expect(input()).toHaveAttribute("inputmode", "decimal");
    expect(input()).toHaveAttribute("autocomplete", "off");
    expect(input()).toHaveAccessibleDescription("Disponible");
  });

  it("adds thousands separators while typing", async () => {
    renderWithProviders(<ControlledAmount />);

    await userEvent.type(input(), "12450.8");

    expect(input()).toHaveValue("12,450.8");
  });

  it("ignores letters, a second dot and a third decimal", async () => {
    renderWithProviders(<ControlledAmount />);

    await userEvent.type(input(), "1a2.3.45x6");

    expect(input()).toHaveValue("12.34");
  });

  it("stops at the maximum amount so the value never overflows", async () => {
    renderWithProviders(<ControlledAmount />);

    await userEvent.type(input(), "12345678.999");

    expect(input()).toHaveValue("123,456.99");
  });

  it("keeps the caret at the same distance from the end when a separator is added", async () => {
    renderWithProviders(<ControlledAmount initial="1,245" />);
    input().setSelectionRange(1, 1);

    await userEvent.type(input(), "9", { initialSelectionStart: 1, initialSelectionEnd: 1 });

    expect(input()).toHaveValue("19,245");
    expect(input().selectionStart).toBe(2);
  });

  it("keeps the caret in place when a key is ignored", async () => {
    renderWithProviders(<ControlledAmount initial="1,245" />);

    await userEvent.type(input(), "x", { initialSelectionStart: 2, initialSelectionEnd: 2 });

    expect(input()).toHaveValue("1,245");
    expect(input().selectionStart).toBe(2);
  });

  it("describes the input with its error instead of the hint", () => {
    renderWithProviders(
      <AmountInput id="amount" label="Monto" value="0" onChange={() => {}} hint="Disponible" error="Monto inválido" />,
    );

    expect(screen.getByLabelText("Monto")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Monto")).toHaveAccessibleDescription("Monto inválido");
  });
});
