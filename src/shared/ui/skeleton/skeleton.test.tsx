import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { Skeleton } from "./skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "./types";

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = renderWithProviders(<Skeleton shape={SKELETON_SHAPE.LINE} />);

    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });

  it.each(Object.values(SKELETON_SHAPE))("applies the %s shape class", (shape) => {
    const { container } = renderWithProviders(<Skeleton shape={shape} />);

    expect(container.querySelector("span")?.className).toContain(`skeleton--${shape}`);
  });

  it("defaults to the md size", () => {
    const { container } = renderWithProviders(<Skeleton shape={SKELETON_SHAPE.LINE} />);

    expect(container.querySelector("span")?.className).toContain(`skeleton--${SKELETON_SIZE.MD}`);
  });

  it("applies an explicit width", () => {
    const { container } = renderWithProviders(<Skeleton shape={SKELETON_SHAPE.LINE} width="60%" />);

    expect(container.querySelector("span")).toHaveStyle({ width: "60%" });
  });
});
