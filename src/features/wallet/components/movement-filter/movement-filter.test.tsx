import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { MovementFilter } from "./movement-filter";

describe("MovementFilter", () => {
  it("renders the three options with the labeled radiogroup", () => {
    renderWithProviders(<MovementFilter value="all" onChange={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Filtrar movimientos" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Todos" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Enviados" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Recibidos" })).not.toBeChecked();
  });

  it("calls onChange with the selected value", async () => {
    const onChange = vi.fn();
    renderWithProviders(<MovementFilter value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Recibidos" }));

    expect(onChange).toHaveBeenCalledWith("credit");
  });
});
