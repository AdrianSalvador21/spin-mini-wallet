import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { RetryAlert } from "./retry-alert";

describe("RetryAlert", () => {
  it("shows the title, the reference and a retry button", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <RetryAlert title="No pudimos cargar tu saldo" retryLabel="Reintentar" onRetry={onRetry} requestId="req-1" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar tu saldo");
    expect(alert).toHaveTextContent("Referencia: req-1");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the reference when there is none", () => {
    renderWithProviders(<RetryAlert title="Error" retryLabel="Reintentar" onRetry={vi.fn()} />);

    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
  });
});
