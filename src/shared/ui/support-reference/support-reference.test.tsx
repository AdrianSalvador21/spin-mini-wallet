import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { renderWithProviders, screen } from "@/test/render";
import { SupportReference } from "./support-reference";
import { COPY_FEEDBACK_MS } from "./types";

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

async function clickCopy() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copiar referencia" }));
  });
}

describe("SupportReference", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("shows the label, the id in a code element and a 44 px copy button", () => {
    renderWithProviders(<SupportReference requestId="req-1" />);

    const code = screen.getByText("req-1");
    const button = screen.getByRole("button", { name: "Copiar referencia" });

    expect(code.tagName).toBe("CODE");
    expect(code.closest("p")).toHaveTextContent("Referencia: req-1");
    expect(button).toHaveTextContent("Copiar");
    expect(button).toHaveAttribute("type", BUTTON_TYPE.BUTTON);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("copies the id, shows Copiado and returns to Copiar after the feedback delay", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    renderWithProviders(<SupportReference requestId="req-1" />);

    await clickCopy();

    const button = screen.getByRole("button", { name: "Copiar referencia" });
    expect(writeText).toHaveBeenCalledWith("req-1");
    expect(button).toHaveTextContent("Copiado");
    expect(screen.getByRole("status")).toHaveTextContent("Copiado");

    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS);
    });

    expect(button).toHaveTextContent("Copiar");
    expect(button).not.toHaveTextContent("Copiado");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows No se pudo copiar when the clipboard rejects", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    renderWithProviders(<SupportReference requestId="req-1" />);

    await clickCopy();

    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
    expect(screen.getByRole("button", { name: "Copiar referencia" })).toHaveTextContent("Copiar");

    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS);
    });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows No se pudo copiar when there is no clipboard", async () => {
    renderWithProviders(<SupportReference requestId="req-1" />);

    await clickCopy();

    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
  });
});
