import { describe, expect, it } from "vitest";
import { ROUTES } from "@/shared/lib/routes";
import { renderWithProviders, screen } from "@/test/render";
import { AppBar } from "./app-bar";

describe("AppBar", () => {
  it("renders a labeled back link to the given href", () => {
    renderWithProviders(<AppBar title="Crea tu cuenta" backHref={ROUTES.LOGIN} />);

    expect(screen.getByRole("link", { name: "Regresar" })).toHaveAttribute("href", ROUTES.LOGIN);
  });

  it("renders the title as the page heading", () => {
    renderWithProviders(<AppBar title="Crea tu cuenta" backHref={ROUTES.LOGIN} />);

    expect(screen.getByRole("heading", { level: 1, name: "Crea tu cuenta" })).toBeInTheDocument();
  });
});
