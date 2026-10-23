import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Checkbox } from "./checkbox";

function ControlledCheckbox({ onChange }: { onChange: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(true);

  return (
    <Checkbox
      id="favorite"
      label="Guardar en favoritos"
      checked={checked}
      onChange={(value) => {
        setChecked(value);
        onChange(value);
      }}
    />
  );
}

describe("Checkbox", () => {
  it("is a checkbox labeled by its text", () => {
    renderWithProviders(<Checkbox id="favorite" label="Guardar en favoritos" checked onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Guardar en favoritos" })).toBeChecked();
  });

  it("toggles and reports the new value", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ControlledCheckbox onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Guardar en favoritos" });
    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getByText("Guardar en favoritos"));

    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("forwards its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProviders(<Checkbox id="favorite" label="Guardar" checked={false} onChange={vi.fn()} ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("checkbox"));
  });
});
