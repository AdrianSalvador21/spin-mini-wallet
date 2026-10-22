import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SummarySkeleton } from "./summary-skeleton";

describe("SummarySkeleton", () => {
  it("renders a hidden header and aside shaped like the real blocks", () => {
    const { container } = renderWithProviders(<SummarySkeleton />);

    expect(container.querySelector("header")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("section")).toHaveAttribute("aria-hidden", "true");
  });
});
