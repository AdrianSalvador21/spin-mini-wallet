import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { renderWithProviders, screen } from "@/test/render";
import { Chip } from "./chip";

function ToggleChip() {
  const [pressed, setPressed] = useState(false);

  return (
    <Chip pressed={pressed} onClick={() => setPressed((value) => !value)}>
      $100
    </Chip>
  );
}

describe("Chip", () => {
  it("is a button that is not pressed by default", () => {
    renderWithProviders(<Chip onClick={vi.fn()}>$100</Chip>);

    const chip = screen.getByRole("button", { name: "$100" });

    expect(chip).toHaveAttribute("type", BUTTON_TYPE.BUTTON);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles aria-pressed when the caller updates it on click", async () => {
    renderWithProviders(<ToggleChip />);

    const chip = screen.getByRole("button", { name: "$100" });
    await userEvent.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.className).toContain("chip--pressed");

    await userEvent.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("does not call onClick while disabled", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Chip onClick={onClick} disabled>
        Todo
      </Chip>,
    );

    const chip = screen.getByRole("button", { name: "Todo" });
    await userEvent.click(chip);

    expect(chip).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
