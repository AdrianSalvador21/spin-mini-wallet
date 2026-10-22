import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Segmented, type SegmentedOption } from "./segmented";

const OPTIONS: readonly SegmentedOption<"phone" | "email">[] = [
  { value: "phone", label: "Celular" },
  { value: "email", label: "Email" },
];

function ControlledSegmented({ onChange }: { onChange?: (value: "phone" | "email") => void }) {
  const [value, setValue] = useState<"phone" | "email">("phone");

  return (
    <Segmented
      label="Método de acceso"
      name="method"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("Segmented", () => {
  it("renders the options as radios inside a labeled radiogroup", () => {
    renderWithProviders(<ControlledSegmented />);

    const group = screen.getByRole("radiogroup", { name: "Método de acceso" });

    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Celular" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Email" })).not.toBeChecked();
  });

  it("marks the selected option with the active modifier", () => {
    renderWithProviders(<ControlledSegmented />);

    expect(screen.getByText("Celular").className).toContain("segmented__option--active");
    expect(screen.getByText("Email").className).not.toContain("segmented__option--active");
  });

  it("calls onChange when an option is clicked", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ControlledSegmented onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Email" }));

    expect(onChange).toHaveBeenCalledWith("email");
    expect(screen.getByRole("radio", { name: "Email" })).toBeChecked();
  });

  it("moves the selection with the arrow keys", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ControlledSegmented onChange={onChange} />);

    screen.getByRole("radio", { name: "Celular" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("email");
    expect(screen.getByRole("radio", { name: "Email" })).toHaveFocus();
  });
});
