import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { server } from "@/test/msw/server";
import { BalanceCard } from "./balance-card";

afterEach(() => {
  document.cookie = "smw_balance_hidden=; Path=/; Max-Age=0";
});

describe("BalanceCard", () => {
  it("renders the balance from the API", async () => {
    renderWithProviders(<BalanceCard initialHidden={false} />);

    expect(await screen.findByText("$12,450")).toBeInTheDocument();
    expect(screen.getByText(".80")).toBeInTheDocument();
  });

  it("starts hidden when initialHidden is true", async () => {
    renderWithProviders(<BalanceCard initialHidden />);

    expect(await screen.findByLabelText("Saldo oculto")).toBeInTheDocument();
    expect(screen.queryByText("$12,450")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar saldo" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the amount, aria-pressed, the label and writes the cookie", async () => {
    renderWithProviders(<BalanceCard initialHidden={false} />);
    await screen.findByText("$12,450");

    const eye = screen.getByRole("button", { name: "Ocultar saldo" });
    expect(eye).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(eye);

    expect(screen.getByRole("button", { name: "Mostrar saldo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Saldo oculto")).toBeInTheDocument();
    expect(document.cookie).toContain("smw_balance_hidden=1");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar saldo" }));

    expect(await screen.findByText("$12,450")).toBeInTheDocument();
    expect(document.cookie).not.toContain("smw_balance_hidden=1");
  });

  it("shows the error with Reintentar and the reference on a 503, and retrying refetches", async () => {
    server.use(
      http.get(
        "/api/v1/wallet/summary",
        () =>
          HttpResponse.json(
            { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-1" } },
            { status: 503, headers: { "x-request-id": "req-1" } },
          ),
        { once: true },
      ),
    );

    renderWithProviders(<BalanceCard initialHidden={false} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tu saldo");
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-1");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("$12,450")).toBeInTheDocument();
  });

  it("links Enviar dinero to /transfers/new/amount from outside the balance panel", async () => {
    renderWithProviders(<BalanceCard initialHidden={false} />);

    const link = await screen.findByRole("link", { name: /Enviar dinero/ });
    const panel = screen.getByRole("region", { name: "Saldo disponible" });

    expect(link).toHaveAttribute("href", "/transfers/new/amount");
    expect(panel).not.toContainElement(link);
  });

  it("shows the masked phone, the white logo and the rings on the loaded panel", async () => {
    const { container } = renderWithProviders(<BalanceCard initialHidden={false} />);

    expect(await screen.findByText("Celular 55 •••• 5678")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Saldo disponible" });
    expect(panel.querySelector('img[src*="spin-oxxo-logo.svg"]')).not.toBeNull();
    expect(container.querySelector('img[src*="spin-rings.svg"]')).toHaveAttribute("aria-hidden", "true");
  });
});
