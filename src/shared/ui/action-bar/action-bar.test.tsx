import { describe, expect, it } from "vitest";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { renderWithProviders, screen } from "@/test/render";
import { ActionBar } from "./action-bar";

describe("ActionBar", () => {
  it("renders its children inside the action bar block", () => {
    renderWithProviders(
      <ActionBar className="extra">
        <button type={BUTTON_TYPE.BUTTON}>Continuar</button>
      </ActionBar>,
    );

    const bar = screen.getByRole("button", { name: "Continuar" }).parentElement;

    expect(bar?.className).toContain("action-bar");
    expect(bar?.className).toContain("extra");
  });
});
