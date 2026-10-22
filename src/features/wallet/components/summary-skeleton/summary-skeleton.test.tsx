import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SummarySkeleton } from "./summary-skeleton";

describe("SummarySkeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = renderWithProviders(<SummarySkeleton />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
