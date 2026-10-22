import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { WizardActions } from "./wizard-actions";

const AMOUNT_ROUTE = "/transfers/new/amount" as Route;

describe("WizardActions", () => {
  it("renders the back link and the step's call to action", () => {
    renderWithProviders(
      <WizardActions backHref={AMOUNT_ROUTE}>
        <button type="submit">Continuar</button>
      </WizardActions>,
    );

    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute("href", AMOUNT_ROUTE);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("accepts a custom back label", () => {
    renderWithProviders(
      <WizardActions backHref={AMOUNT_ROUTE} backLabel="Editar datos">
        <button type="button">Confirmar envío</button>
      </WizardActions>,
    );

    expect(screen.getByRole("link", { name: "Editar datos" })).toBeInTheDocument();
  });

  it("marks the back link to stay visible on mobile when asked", () => {
    renderWithProviders(
      <WizardActions backHref={AMOUNT_ROUTE} backOnMobile>
        <button type="button">Confirmar envío</button>
      </WizardActions>,
    );

    expect(screen.getByRole("link", { name: "Atrás" }).parentElement?.className).toContain(
      "wizard-actions__back--mobile",
    );
  });
});
