import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders the Spin by OXXO logo with an accessible alt text", () => {
    renderWithProviders(<BrandLogo />);

    const logo = screen.getByRole("img", { name: "Spin by OXXO" });

    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", expect.stringContaining("spin-oxxo-logo.svg"));
  });
});
