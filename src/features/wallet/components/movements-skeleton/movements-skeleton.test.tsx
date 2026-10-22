import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { MovementsSkeleton } from "./movements-skeleton";

describe("MovementsSkeleton", () => {
  it("renders 5 rows by default and is hidden from assistive technology", () => {
    const { container } = renderWithProviders(<MovementsSkeleton />);
    const list = container.querySelector("ul");

    expect(list).toHaveAttribute("aria-hidden", "true");
    expect(list?.children).toHaveLength(5);
  });

  it("renders the requested number of rows", () => {
    const { container } = renderWithProviders(<MovementsSkeleton rows={3} />);

    expect(container.querySelector("ul")?.children).toHaveLength(3);
  });

  it("wraps the rows in the card chrome when fullCard is true", () => {
    const { container } = renderWithProviders(<MovementsSkeleton fullCard />);

    expect(container.querySelector("section")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("ul")?.children).toHaveLength(5);
  });
});
