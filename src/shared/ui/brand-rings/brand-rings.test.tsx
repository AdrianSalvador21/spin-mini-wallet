import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { BrandRings } from "./brand-rings";
import { RINGS_PLACEMENT, RINGS_SIZE } from "./types";

describe("BrandRings", () => {
  it("renders the rings texture as a decorative image", () => {
    const { container } = renderWithProviders(
      <BrandRings placement={RINGS_PLACEMENT.TOP_RIGHT} size={RINGS_SIZE.MD} />,
    );

    const image = container.querySelector("img");

    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("aria-hidden", "true");
    expect(image).toHaveAttribute("src", expect.stringContaining("spin-rings.svg"));
  });

  it.each(Object.values(RINGS_PLACEMENT))("applies the %s placement class", (placement) => {
    const { container } = renderWithProviders(<BrandRings placement={placement} size={RINGS_SIZE.SM} />);

    expect(container.querySelector("img")?.className).toContain(`brand-rings--${placement}`);
  });

  it.each(Object.values(RINGS_SIZE))("applies the %s size class", (size) => {
    const { container } = renderWithProviders(
      <BrandRings placement={RINGS_PLACEMENT.BOTTOM_LEFT} size={size} />,
    );

    expect(container.querySelector("img")?.className).toContain(`brand-rings--${size}`);
  });
});
