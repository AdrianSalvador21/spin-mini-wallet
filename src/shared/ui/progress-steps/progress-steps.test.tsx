import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ProgressSteps } from "./progress-steps";

describe("ProgressSteps", () => {
  it("is a labeled progressbar that exposes the current step", () => {
    renderWithProviders(<ProgressSteps current={2} total={3} label="Progreso del envío" />);

    const progress = screen.getByRole("progressbar", { name: "Progreso del envío" });

    expect(progress).toHaveAttribute("aria-valuenow", "2");
    expect(progress).toHaveAttribute("aria-valuemax", "3");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
  });

  it("draws one bar per step and fills the first current ones", () => {
    renderWithProviders(<ProgressSteps current={2} total={3} label="Progreso del envío" />);

    const bars = [...screen.getByRole("progressbar").children];

    expect(bars).toHaveLength(3);
    expect(bars.map((bar) => bar.className.includes("progress-steps__bar--done"))).toEqual([true, true, false]);
  });
});
