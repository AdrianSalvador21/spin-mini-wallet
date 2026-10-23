import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import { renderWithProviders, screen } from "@/test/render";
import { SUBMISSION_STATUS, type SubmissionStatus } from "../../submission/types";
import { ProcessingDialog } from "./processing-dialog";

const AMOUNT = toMoney(10_000 as Cents);

function renderDialog(status: SubmissionStatus) {
  return renderWithProviders(<ProcessingDialog status={status} amount={AMOUNT} recipientName="Carlos Ruiz" />);
}

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProcessingDialog", () => {
  it("opens as a modal while processing and shows the amount and the first name", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");

    renderDialog(SUBMISSION_STATUS.PROCESSING);

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByText("Enviando $100.00 a Carlos")).toBeInTheDocument();
    expect(screen.getByText("Esto toma unos segundos. No cierres esta ventana.")).toBeInTheDocument();
  });

  it("is busy, labelled by its title and has the progress label", () => {
    renderDialog(SUBMISSION_STATUS.PROCESSING);

    const title = screen.getByText("Enviando $100.00 a Carlos");

    expect(dialog()).toHaveAttribute("aria-busy", "true");
    expect(dialog()).toHaveAttribute("aria-labelledby", title.id);
    expect(screen.getByRole("progressbar", { name: "Procesando", hidden: true })).toBeInTheDocument();
  });

  it("draws the orbit as decoration and shows the color logo", () => {
    renderDialog(SUBMISSION_STATUS.PROCESSING);

    const orbit = screen.getByRole("progressbar", { name: "Procesando", hidden: true });

    expect(orbit.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("img", { name: "Spin by OXXO", hidden: true })).toHaveAttribute(
      "src",
      expect.stringContaining("spin-oxxo-logo-color.svg"),
    );
  });

  it("does not close on Esc", () => {
    renderDialog(SUBMISSION_STATUS.PROCESSING);

    const notCancelled = fireEvent(dialog(), new Event("cancel", { cancelable: true }));

    expect(notCancelled).toBe(false);
    expect(dialog()).toHaveAttribute("open");
  });

  it("shows its own title while checking", () => {
    renderDialog(SUBMISSION_STATUS.CHECKING);

    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByText("Revisando el estado de tu envío")).toBeInTheDocument();
    expect(screen.queryByText(/Enviando/)).not.toBeInTheDocument();
  });

  it("stays open after a success until the receipt replaces the review", () => {
    renderDialog(SUBMISSION_STATUS.SUCCEEDED);

    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByText("Enviando $100.00 a Carlos")).toBeInTheDocument();
  });

  it.each([SUBMISSION_STATUS.IDLE, SUBMISSION_STATUS.FAILED])("stays closed while %s", (status) => {
    renderDialog(status);

    expect(dialog()).not.toHaveAttribute("open");
  });

  it("closes when the status leaves processing", () => {
    const { rerender } = renderDialog(SUBMISSION_STATUS.PROCESSING);

    rerender(<ProcessingDialog status={SUBMISSION_STATUS.FAILED} amount={AMOUNT} recipientName="Carlos Ruiz" />);

    expect(dialog()).not.toHaveAttribute("open");
  });

  it("throws for an unknown status", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderDialog("teleport" as unknown as SubmissionStatus)).toThrow(/Unreachable case/);
  });
});
