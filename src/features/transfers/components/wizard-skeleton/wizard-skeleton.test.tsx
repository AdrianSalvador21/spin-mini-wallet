import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { WizardSkeleton } from "./wizard-skeleton";

describe("WizardSkeleton", () => {
  it("renders placeholder lines hidden from assistive technology", () => {
    renderWithProviders(<WizardSkeleton />);

    const skeleton = screen.getByTestId("wizard-skeleton");

    expect(skeleton.children).toHaveLength(3);
    expect([...skeleton.children].every((line) => line.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
