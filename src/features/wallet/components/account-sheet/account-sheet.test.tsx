import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { AccountSheet } from "./account-sheet";

const USER = { fullName: "Mariana López", maskedPhone: "55 •••• 5678", email: "mariana@spin.test" };

describe("AccountSheet", () => {
  it("shows the masked phone, the email and the logout slot", () => {
    renderWithProviders(
      <AccountSheet open onClose={vi.fn()} user={USER} logoutSlot={<button>Cerrar sesión</button>} />,
    );

    expect(screen.getByText("Mariana López")).toBeInTheDocument();
    expect(screen.getByText("+52 55 •••• 5678")).toBeInTheDocument();
    expect(screen.getByText("mariana@spin.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("exposes Mi cuenta as the dialog's accessible label", () => {
    const { container } = renderWithProviders(
      <AccountSheet open onClose={vi.fn()} user={USER} logoutSlot={null} />,
    );

    expect(container.querySelector("dialog")).toHaveAttribute("aria-label", "Mi cuenta");
  });
});
