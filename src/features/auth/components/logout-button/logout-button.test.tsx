import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { renderWithProviders, screen } from "@/test/render";
import { LogoutButton } from "./logout-button";

const mocks = vi.hoisted(() => ({ logoutAction: vi.fn() }));

vi.mock("../../actions", () => ({ logoutAction: mocks.logoutAction }));

beforeEach(() => {
  mocks.logoutAction.mockReset();
});

describe("LogoutButton", () => {
  it("renders a submit button", () => {
    renderWithProviders(<LogoutButton />);

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toHaveAttribute("type", BUTTON_TYPE.SUBMIT);
  });

  it("calls the logout action and shows the loading state while it runs", async () => {
    const pending = Promise.withResolvers<void>();
    mocks.logoutAction.mockReturnValue(pending.promise);
    renderWithProviders(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(mocks.logoutAction).toHaveBeenCalledOnce();
    const button = await screen.findByRole("button", { name: "Cerrando sesión…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    pending.resolve();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });
});
