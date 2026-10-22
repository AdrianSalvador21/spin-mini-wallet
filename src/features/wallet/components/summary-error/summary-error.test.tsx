import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { SummaryError } from "./summary-error";

describe("SummaryError", () => {
  it("shows the title and retry button", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<SummaryError onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tu saldo");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the reference when a requestId is present", () => {
    renderWithProviders(<SummaryError onRetry={vi.fn()} requestId="req-1" />);

    expect(screen.getByText("Referencia: req-1")).toBeInTheDocument();
  });

  it("omits the reference when there is none", () => {
    renderWithProviders(<SummaryError onRetry={vi.fn()} />);

    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
  });
});
