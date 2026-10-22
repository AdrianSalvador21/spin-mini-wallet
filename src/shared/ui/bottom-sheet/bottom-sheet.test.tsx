import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/render";
import { BottomSheet } from "./bottom-sheet";

function renderSheet(open: boolean, onClose = vi.fn()) {
  const { container } = renderWithProviders(
    <BottomSheet open={open} label="Mi cuenta" closeLabel="Cerrar" onClose={onClose}>
      <p>Contenido</p>
    </BottomSheet>,
  );
  const dialog = container.querySelector("dialog") as HTMLDialogElement;

  return { dialog, onClose };
}

describe("BottomSheet", () => {
  it("calls showModal and sets the accessible label when open", () => {
    const { dialog } = renderSheet(true);

    expect(dialog.open).toBe(true);
    expect(dialog).toHaveAttribute("aria-label", "Mi cuenta");
  });

  it("does not open the dialog when closed", () => {
    const { dialog } = renderSheet(false);

    expect(dialog.open).toBe(false);
  });

  it("calls onClose when Esc fires the cancel event", () => {
    const { dialog, onClose } = renderSheet(true);

    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on a backdrop click", () => {
    const { dialog, onClose } = renderSheet(true);

    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the panel", () => {
    const { onClose } = renderSheet(true);

    fireEvent.click(screen.getByText("Contenido"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on the close button", () => {
    const { onClose } = renderSheet(true);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
