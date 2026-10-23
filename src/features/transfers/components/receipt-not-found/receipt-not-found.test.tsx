import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ReceiptNotFound } from "./receipt-not-found";

describe("ReceiptNotFound", () => {
  it("explains the receipt was not found and links home", () => {
    renderWithProviders(<ReceiptNotFound />);

    expect(screen.getByText("No encontramos este comprobante")).toBeInTheDocument();
    expect(screen.getByText("Revisa el enlace o vuelve al inicio.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/home");
  });
});
