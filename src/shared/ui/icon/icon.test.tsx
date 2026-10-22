import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Icon } from "./icon";
import { ICON_NAME, ICON_SIZE } from "./types";

describe("Icon", () => {
  it("is hidden from assistive technology without a label", () => {
    const { container } = renderWithProviders(<Icon name={ICON_NAME.CHECK} />);

    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("is an image with an accessible name when it has a label", () => {
    renderWithProviders(<Icon name={ICON_NAME.ALERT} label="Error" />);

    const svg = screen.getByRole("img", { name: "Error" });

    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("defaults to the md size", () => {
    const { container } = renderWithProviders(<Icon name={ICON_NAME.BACK} />);

    expect(container.querySelector("svg")?.getAttribute("class")).toContain(`icon--${ICON_SIZE.MD}`);
  });

  it("applies the requested size", () => {
    const { container } = renderWithProviders(<Icon name={ICON_NAME.BACK} size={ICON_SIZE.SM} />);

    expect(container.querySelector("svg")?.getAttribute("class")).toContain(`icon--${ICON_SIZE.SM}`);
  });

  it.each(Object.values(ICON_NAME))("draws the %s icon", (name) => {
    const { container } = renderWithProviders(<Icon name={name} />);

    expect(container.querySelector("svg")?.childElementCount).toBeGreaterThan(0);
  });
});
