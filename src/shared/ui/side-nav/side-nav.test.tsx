import type { Route } from "next";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { SideNav, type SideNavItem } from "./side-nav";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const ITEMS: SideNavItem[] = [
  { href: "/home", label: "Inicio", icon: ICON_NAME.HOME },
  { href: "/transfers/new/amount" as Route, label: "Enviar dinero", icon: ICON_NAME.SEND },
];

describe("SideNav", () => {
  it("marks the current path with aria-current and keeps the label as the link's accessible name", () => {
    usePathnameMock.mockReturnValue("/home");

    renderWithProviders(<SideNav items={ITEMS} label="Navegación principal" />);

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Enviar dinero" })).not.toHaveAttribute("aria-current");
  });

  it("exposes its own accessible label", () => {
    usePathnameMock.mockReturnValue("/home");

    renderWithProviders(<SideNav items={ITEMS} label="Navegación principal" />);

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
  });

  it("renders the user and footer slots", () => {
    usePathnameMock.mockReturnValue("/home");

    renderWithProviders(
      <SideNav items={ITEMS} label="Navegación principal" user={<p>Mariana</p>} footer={<p>Salir</p>} />,
    );

    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Salir")).toBeInTheDocument();
  });

  it("does not mark any item as active outside its path", () => {
    usePathnameMock.mockReturnValue("/transfers/new/recipient");

    renderWithProviders(<SideNav items={ITEMS} label="Navegación principal" />);

    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Enviar dinero" })).not.toHaveAttribute("aria-current");
  });
});
