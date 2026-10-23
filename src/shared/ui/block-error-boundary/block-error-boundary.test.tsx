import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { consoleErrorReporter } from "@/shared/observability/error-reporter";
import { BlockErrorBoundary } from "./block-error-boundary";

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("boom");
  }

  return <p>Recuperado</p>;
}

function Harness() {
  const [shouldThrow, setShouldThrow] = useState(true);

  return (
    <>
      <button onClick={() => setShouldThrow(false)}>Arreglar</button>
      <BlockErrorBoundary title="No pudimos mostrar esta sección" retryLabel="Reintentar">
        <Boom shouldThrow={shouldThrow} />
      </BlockErrorBoundary>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BlockErrorBoundary", () => {
  it("renders the fallback when a child throws and reports the error once", () => {
    const captureSpy = vi.spyOn(consoleErrorReporter, "captureException").mockImplementation(() => {});

    renderWithProviders(<Harness />);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos mostrar esta sección");
    expect(captureSpy).toHaveBeenCalledTimes(1);
  });

  it("re-renders the children when retry succeeds", async () => {
    vi.spyOn(consoleErrorReporter, "captureException").mockImplementation(() => {});

    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Arreglar" }));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Recuperado")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
