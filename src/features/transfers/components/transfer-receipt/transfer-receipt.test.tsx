import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import { buildTransfer } from "@/test/factories/transfers";
import { renderWithProviders, screen, within } from "@/test/render";
import { TransferReceipt } from "./transfer-receipt";

const SHARE_TEXT =
  "Envié $100.00 a Carlos Ruiz (Celular •••• 6789) el 21 oct 2026, 10:42 h. Folio: SPN-48213907. Clave de rastreo: SPIN2026102116420001.";

function rows() {
  const list = screen.getAllByRole("term")[0].closest("dl") as HTMLElement;

  return within(list)
    .getAllByRole("term")
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

function shareButton() {
  return screen.getByRole("button", { name: /^Compartir/ });
}

function stubNavigator(values: { share?: unknown; clipboard?: unknown }) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("TransferReceipt", () => {
  it("shows the success title in a status region with focus, the amount and the date", () => {
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    const title = screen.getByRole("heading", { level: 1, name: "¡Envío exitoso!" });

    expect(title).toHaveFocus();
    expect(title.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("21 oct 2026, 10:42 h")).toBeInTheDocument();
  });

  it("styles the receipt as a ticket with the color logo and a decorative tear line", () => {
    const { container } = renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    expect(screen.getByRole("img", { name: "Spin by OXXO" })).toHaveAttribute(
      "src",
      expect.stringContaining("spin-oxxo-logo-color.svg"),
    );
    expect(container.querySelector('[class*="transfer-receipt__tear"]')).toHaveAttribute("aria-hidden", "true");
  });

  it("lists the recipient, masked account, folio and tracking key, without a concept row when there is none", () => {
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    expect(rows()).toEqual([
      ["Para", "Carlos Ruiz"],
      ["Cuenta", "Celular •••• 6789"],
      ["Folio", "SPN-48213907"],
      ["Clave de rastreo", "SPIN2026102116420001"],
    ]);
  });

  it("shows the concept and the bank when they are set", () => {
    renderWithProviders(
      <TransferReceipt
        transfer={buildTransfer({
          concept: "Cena viernes",
          recipient: {
            name: "Ana Torres",
            account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, masked: "•••• 5433", bankName: "Banamex" },
          },
        })}
      />,
    );

    expect(rows()).toEqual([
      ["Para", "Ana Torres"],
      ["Cuenta", "CLABE •••• 5433Banamex"],
      ["Concepto", "Cena viernes"],
      ["Folio", "SPN-48213907"],
      ["Clave de rastreo", "SPIN2026102116420001"],
    ]);
  });

  it("labels the share button with the full and the short text, one per breakpoint", () => {
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    expect(shareButton()).toHaveTextContent("Compartir comprobante");
    expect(within(shareButton()).getByText("Compartir").className).toContain("transfer-receipt__share-short");
  });

  it("links Volver al inicio home", () => {
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/home");
  });

  it("shares the masked text with no URL through navigator.share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    await userEvent.click(shareButton());

    expect(share).toHaveBeenCalledWith({ title: "Comprobante de envío Spin", text: SHARE_TEXT });
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty("url");
    expect(SHARE_TEXT).not.toMatch(/https?:|\/transfers\//);
    expect(SHARE_TEXT).toContain("•••• 6789");
    expect(SHARE_TEXT).not.toContain("5523456789");
  });

  it("ignores an AbortError when the user cancels the share sheet", async () => {
    const writeText = vi.fn();
    stubNavigator({
      share: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
      clipboard: { writeText },
    });
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    await userEvent.click(shareButton());

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText("Comprobante copiado")).not.toBeInTheDocument();
    expect(screen.queryByText("No pudimos compartir el comprobante")).not.toBeInTheDocument();
  });

  it("copies the text and announces it without navigator.share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } });
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    await userEvent.click(shareButton());

    expect(writeText).toHaveBeenCalledWith(SHARE_TEXT);
    expect(await screen.findByText("Comprobante copiado")).toHaveAttribute("role", "status");
  });

  it("falls back to the clipboard when navigator.share fails for another reason", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: vi.fn().mockRejectedValue(new TypeError("not allowed")), clipboard: { writeText } });
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    await userEvent.click(shareButton());

    expect(writeText).toHaveBeenCalledWith(SHARE_TEXT);
    expect(await screen.findByText("Comprobante copiado")).toBeInTheDocument();
  });

  it("announces a failure when neither share nor the clipboard works", async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    renderWithProviders(<TransferReceipt transfer={buildTransfer()} />);

    await userEvent.click(shareButton());

    expect(await screen.findByText("No pudimos compartir el comprobante")).toHaveAttribute("role", "status");
  });
});
