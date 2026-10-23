import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen, within } from "@/test/render";
import { Stepper, type StepperStep } from "./stepper";
import { STEP_STATE } from "./types";

const AMOUNT_ROUTE = "/transfers/new/amount" as Route;
const RECIPIENT_ROUTE = "/transfers/new/recipient" as Route;
const REVIEW_ROUTE = "/transfers/new/review" as Route;

const STEPS: StepperStep[] = [
  { label: "Monto", state: STEP_STATE.DONE, href: AMOUNT_ROUTE },
  { label: "Destinatario", state: STEP_STATE.CURRENT, href: RECIPIENT_ROUTE },
  { label: "Revisión", state: STEP_STATE.UPCOMING, href: REVIEW_ROUTE },
];

describe("Stepper", () => {
  it("renders a labeled ordered list with one item per step", () => {
    renderWithProviders(<Stepper steps={STEPS} label="Progreso del envío" />);

    const list = screen.getByRole("list", { name: "Progreso del envío" });

    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("marks only the current step with aria-current=step", () => {
    renderWithProviders(<Stepper steps={STEPS} label="Progreso del envío" />);

    const items = screen.getAllByRole("listitem");

    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null]);
    expect(items[1]).toHaveTextContent("Destinatario");
  });

  it("links done steps and does not link the current or upcoming ones", () => {
    renderWithProviders(<Stepper steps={STEPS} label="Progreso del envío" />);

    expect(screen.getByRole("link", { name: "Monto" })).toHaveAttribute("href", AMOUNT_ROUTE);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("does not link a done step without an href", () => {
    renderWithProviders(
      <Stepper steps={[{ label: "Monto", state: STEP_STATE.DONE }, STEPS[1]]} label="Progreso del envío" />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("numbers pending steps and shows a check on done ones", () => {
    renderWithProviders(<Stepper steps={STEPS} label="Progreso del envío" />);

    const items = screen.getAllByRole("listitem");

    expect(items[0].querySelector("svg")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("2");
    expect(items[2]).toHaveTextContent("3");
  });
});
