import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ReceiptSkeleton } from "./receipt-skeleton";
import { RECEIPT_SKELETON_ROWS } from "./types";

describe("ReceiptSkeleton", () => {
  it("renders the receipt's head and rows as placeholders hidden from assistive technology", () => {
    renderWithProviders(<ReceiptSkeleton />);

    const placeholders = screen.getByTestId("receipt-skeleton").querySelectorAll("span");

    expect(placeholders).toHaveLength(4 + RECEIPT_SKELETON_ROWS);
    expect([...placeholders].every((placeholder) => placeholder.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
