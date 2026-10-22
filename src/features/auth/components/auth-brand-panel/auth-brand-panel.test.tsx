import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { AuthBrandPanel } from "./auth-brand-panel";

describe("AuthBrandPanel", () => {
  it("renders the logo, the headline, the lead and the legal line", () => {
    renderWithProviders(<AuthBrandPanel />);

    expect(screen.getByRole("img", { name: "Spin by OXXO" })).toBeInTheDocument();
    expect(screen.getByText("Envía dinero en segundos")).toBeInTheDocument();
    expect(
      screen.getByText("A un celular, una CLABE o una tarjeta, con tu comprobante al instante."),
    ).toBeInTheDocument();
    expect(screen.getByText("Spin by OXXO · Mini Wallet")).toBeInTheDocument();
  });

  it("lists the three perks", () => {
    renderWithProviders(<AuthBrandPanel />);

    const perks = screen.getAllByRole("listitem");

    expect(perks.map((perk) => perk.textContent)).toEqual([
      "Envíos a celular, CLABE o tarjeta",
      "Comprobante con folio y clave de rastreo",
      "Tu sesión protegida en cada envío",
    ]);
  });
});
