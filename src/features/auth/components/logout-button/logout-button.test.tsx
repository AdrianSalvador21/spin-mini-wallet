import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { renderWithProviders, screen } from "@/test/render";
import { LogoutButton } from "./logout-button";
import { LOGOUT_BUTTON_VARIANT } from "./types";

const mocks = vi.hoisted(() => ({ logoutAction: vi.fn() }));

vi.mock("../../actions", () => ({ logoutAction: mocks.logoutAction }));

beforeEach(() => {
  mocks.logoutAction.mockReset();
});

describe("LogoutButton", () => {
  it("renders a submit button", () => {
    renderWithProviders(<LogoutButton variant={LOGOUT_BUTTON_VARIANT.NAV_ITEM} />);

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toHaveAttribute("type", BUTTON_TYPE.SUBMIT);
  });

  it.each(Object.values(LOGOUT_BUTTON_VARIANT))("applies the %s variant class", (variant) => {
    renderWithProviders(<LogoutButton variant={variant} />);

    expect(screen.getByRole("button", { name: "Cerrar sesión" }).className).toContain(`logout-button--${variant}`);
  });

  it("calls the logout action and shows the loading state while it runs", async () => {
    const pending = Promise.withResolvers<void>();
    mocks.logoutAction.mockReturnValue(pending.promise);
    renderWithProviders(<LogoutButton variant={LOGOUT_BUTTON_VARIANT.MENU_ITEM} />);

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(mocks.logoutAction).toHaveBeenCalledOnce();
    const button = await screen.findByRole("button", { name: "Cerrando sesión…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    pending.resolve();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });
});
