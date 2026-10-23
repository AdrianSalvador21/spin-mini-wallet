import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders the color logo with an accessible alt text on light backgrounds", () => {
    renderWithProviders(<BrandLogo />);

    const logo = screen.getByRole("img", { name: "Spin by OXXO" });

    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", expect.stringContaining("spin-oxxo-logo-color.svg"));
  });

  it("renders the white logo on dark backgrounds", () => {
    renderWithProviders(<BrandLogo onDark />);

    const logo = screen.getByRole("img", { name: "Spin by OXXO" });

    expect(logo).toHaveAttribute("src", expect.stringContaining("spin-oxxo-logo.svg"));
    expect(logo.getAttribute("src")).not.toContain("logo-color");
  });
});
