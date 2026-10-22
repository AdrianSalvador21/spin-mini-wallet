import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ICON_NAME, type IconName } from "@/shared/ui/icon/types";
import { Alert } from "./alert";
import { ALERT_ROLE, ALERT_TONE, type AlertTone } from "./types";

const ICON_PATH_BY_NAME: Partial<Record<IconName, string>> = {
  [ICON_NAME.ALERT]: "M12 7.5v6M12 16.5v.2",
  [ICON_NAME.CLOCK]: "M12 7v5l3.5 2",
  [ICON_NAME.CHECK]: "M5 12.5l4.5 4.5L19 7.5",
};

describe("Alert", () => {
  it.each([
    [ALERT_TONE.DANGER, ICON_NAME.ALERT],
    [ALERT_TONE.WARNING, ICON_NAME.CLOCK],
    [ALERT_TONE.SUCCESS, ICON_NAME.CHECK],
    [ALERT_TONE.INFO, ICON_NAME.ALERT],
  ])("renders the %s tone with the %s icon", (tone, icon) => {
    const { container } = renderWithProviders(<Alert tone={tone}>Mensaje</Alert>);

    const alert = container.firstElementChild;
    const svg = alert?.querySelector("svg");

    expect(alert?.className).toContain(`alert--${tone}`);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector(`path[d="${ICON_PATH_BY_NAME[icon]}"]`)).not.toBeNull();
    expect(screen.getByText("Mensaje")).toBeInTheDocument();
  });

  it("passes the role through", () => {
    renderWithProviders(
      <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
        Algo salió mal.
      </Alert>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal.");
  });

  it("has no role by default", () => {
    renderWithProviders(<Alert tone={ALERT_TONE.INFO}>Procesando</Alert>);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("throws for an unknown tone", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const invalid = "neutral" as unknown as AlertTone;

    expect(() => renderWithProviders(<Alert tone={invalid}>Mensaje</Alert>)).toThrow(/Unreachable case/);

    consoleError.mockRestore();
  });
});
