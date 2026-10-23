import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import { renderWithProviders, screen } from "@/test/render";
import type { TransferOutcome as Outcome } from "../../submission/types";
import { TransferOutcome } from "./transfer-outcome";

const AMOUNT = toMoney(35_000 as Cents);

function renderOutcome(outcome: Outcome) {
  const handlers = { onRetry: vi.fn(), onCheckStatus: vi.fn(), onChangeAmount: vi.fn() };
  const view = renderWithProviders(<TransferOutcome outcome={outcome} {...handlers} />);

  return { ...view, handlers };
}

function primaryButtons(container: HTMLElement) {
  return container.querySelectorAll('[class*="button--primary"]');
}

function actionNames() {
  return [...screen.getAllByRole("button"), ...screen.getAllByRole("link")]
    .filter((element) => element.getAttribute("aria-label") !== "Copiar referencia")
    .map((element) => element.textContent);
}

describe("TransferOutcome", () => {
  it("shows the network error with retry, home and the reference", async () => {
    const { container, handlers } = renderOutcome({ kind: "network_error", requestId: "req-1" });

    expect(screen.getByRole("heading", { level: 1, name: "Se perdió la conexión" })).toBeInTheDocument();
    expect(screen.getByText(/no se hizo ningún cargo/)).toBeInTheDocument();
    expect(actionNames()).toEqual(["Reintentar envío", "Volver al inicio"]);
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/home");
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-1");
    expect(primaryButtons(container)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar envío" }));

    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows insufficient funds with change amount and no reference", async () => {
    const { container, handlers } = renderOutcome({ kind: "insufficient_funds", amount: AMOUNT });

    expect(screen.getByRole("heading", { level: 1, name: "Saldo insuficiente" })).toBeInTheDocument();
    expect(actionNames()).toEqual(["Cambiar monto", "Volver al inicio"]);
    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Cambiar monto" }));

    expect(handlers.onChangeAmount).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Outcome, string]>([
    [
      "the design's text when the balance is below the amount",
      { kind: "insufficient_funds", amount: AMOUNT, balance: toMoney(20_000 as Cents) },
      "Tu saldo cambió mientras enviabas. Hoy tienes $200.00 disponibles y el envío es de $350.00.",
    ],
    [
      "the simulated text when the balance covers the amount",
      { kind: "insufficient_funds", amount: AMOUNT, balance: toMoney(1_245_080 as Cents) },
      "No pudimos completar el envío por falta de saldo. Tu saldo disponible es $12,450.80.",
    ],
    [
      "the generic text without a balance",
      { kind: "insufficient_funds", amount: AMOUNT },
      "No pudimos completar el envío por falta de saldo.",
    ],
  ])("shows %s", (_label, outcome, text) => {
    renderOutcome(outcome);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows the timeout in the warning tone with the status check and the reference", async () => {
    const { container, handlers } = renderOutcome({ kind: "timeout", requestId: "req-2" });

    expect(screen.getByRole("heading", { level: 1, name: "Está tardando más de lo normal" })).toBeInTheDocument();
    expect(container.querySelector('[class*="transfer-outcome__icon--warning"]')).toBeInTheDocument();
    expect(actionNames()).toEqual(["Revisar estado del envío", "Volver al inicio"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-2");
    expect(primaryButtons(container)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Revisar estado del envío" }));

    expect(handlers.onCheckStatus).toHaveBeenCalledTimes(1);
  });

  it("shows not found yet with check again, retry, home and the reference", async () => {
    const { container, handlers } = renderOutcome({ kind: "not_found_yet", requestId: "req-3" });

    expect(screen.getByRole("heading", { level: 1, name: "Todavía no encontramos tu envío" })).toBeInTheDocument();
    expect(actionNames()).toEqual(["Revisar de nuevo", "Reintentar envío", "Volver al inicio"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-3");
    expect(primaryButtons(container)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Revisar de nuevo" }));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar envío" }));

    expect(handlers.onCheckStatus).toHaveBeenCalledTimes(1);
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the unknown error with only a primary home link and the reference", () => {
    const { container } = renderOutcome({ kind: "unknown_error", requestId: "req-4" });

    expect(screen.getByRole("heading", { level: 1, name: "Algo salió mal" })).toBeInTheDocument();
    expect(actionNames()).toEqual(["Volver al inicio"]);
    expect(screen.getByRole("link", { name: "Volver al inicio" }).className).toContain("button--primary");
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-4");
    expect(primaryButtons(container)).toHaveLength(1);
  });

  it("omits the reference when the outcome has none", () => {
    renderOutcome({ kind: "timeout" });

    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
  });

  it("moves focus to the title on mount and when the kind changes", () => {
    const { rerender } = renderOutcome({ kind: "timeout", requestId: "req-5" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();

    screen.getByRole("button", { name: "Revisar estado del envío" }).focus();
    rerender(
      <TransferOutcome
        outcome={{ kind: "not_found_yet", requestId: "req-5" }}
        onRetry={vi.fn()}
        onCheckStatus={vi.fn()}
        onChangeAmount={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Todavía no encontramos tu envío" })).toHaveFocus();
  });

  it("throws for an unknown kind", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderOutcome({ kind: "teleport" } as unknown as Outcome)).toThrow(/Unreachable case/);
    vi.restoreAllMocks();
  });
});
