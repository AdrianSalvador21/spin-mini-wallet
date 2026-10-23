import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { server } from "@/test/msw/server";
import { HomeHeader } from "./home-header";

const NOW = "2026-10-22T18:00:00.000Z";
const LOGOUT_SLOT = <button>Cerrar sesión</button>;

describe("HomeHeader", () => {
  it("renders the greeting with the first name", async () => {
    renderWithProviders(<HomeHeader now={NOW} logoutSlot={LOGOUT_SLOT} />);

    expect(await screen.findByRole("heading", { name: "Hola, Mariana" })).toBeInTheDocument();
    expect(screen.getAllByText("Hola, Mariana")).toHaveLength(2);
  });

  it("shows Hola without a name or avatar on error", async () => {
    server.use(
      http.get(
        "/api/v1/wallet/summary",
        () =>
          HttpResponse.json(
            { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-1" } },
            { status: 503 },
          ),
        { once: true },
      ),
    );

    renderWithProviders(<HomeHeader now={NOW} logoutSlot={LOGOUT_SLOT} />);

    expect(await screen.findByText("Hola,")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir mi cuenta" })).not.toBeInTheDocument();
  });

  it("opens the account sheet with the masked phone, the email and the logout slot", async () => {
    renderWithProviders(<HomeHeader now={NOW} logoutSlot={LOGOUT_SLOT} />);

    const avatarButton = await screen.findByRole("button", { name: "Abrir mi cuenta" });
    await userEvent.click(avatarButton);

    expect(screen.getByText("+52 55 •••• 5678")).toBeInTheDocument();
    expect(screen.getByText("mariana@spin.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
