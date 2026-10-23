import { QueryClient } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/render";
import { writeScenarioCookie } from "../../scenario-cookies";
import { DevPanel } from "./dev-panel";

function renderPanel() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  renderWithProviders(<DevPanel />, { queryClient });

  return { invalidate };
}

async function openPanel() {
  await userEvent.click(screen.getByRole("button", { name: /DEV/ }));
}

afterEach(() => {
  writeScenarioCookie("mock_scenario", null);
  writeScenarioCookie("mock_read_scenario", null);
});

describe("DevPanel", () => {
  it("shows a collapsed pill with the random scenario by default", () => {
    renderPanel();

    const pill = screen.getByRole("button", { name: "DEV Aleatorio" });

    expect(pill).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("region", { name: "Panel DEV" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Envío")).not.toBeInTheDocument();
  });

  it("shows the active transfer scenario read from document.cookie", () => {
    document.cookie = "mock_scenario=insufficient_funds; Path=/";

    renderPanel();

    expect(screen.getByRole("button", { name: "DEV Saldo insuficiente" })).toBeInTheDocument();
  });

  it("writes mock_scenario=timeout when Tiempo de espera is chosen and clears it with Aleatorio", async () => {
    renderPanel();
    await openPanel();

    expect(screen.getByRole("button", { name: /DEV/ })).toHaveAttribute("aria-expanded", "true");

    await userEvent.selectOptions(screen.getByLabelText("Envío"), "Tiempo de espera");

    expect(document.cookie).toContain("mock_scenario=timeout");
    expect(screen.getByRole("button", { name: "DEV Tiempo de espera" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Envío"), "Aleatorio");

    expect(document.cookie).not.toContain("mock_scenario=");
    expect(screen.getByRole("button", { name: "DEV Aleatorio" })).toBeInTheDocument();
  });

  it("writes mock_read_scenario=error and invalidates the queries when Lecturas changes", async () => {
    const { invalidate } = renderPanel();
    await openPanel();

    await userEvent.selectOptions(screen.getByLabelText("Lecturas"), "Error");

    expect(document.cookie).toContain("mock_read_scenario=error");
    expect(invalidate).toHaveBeenCalledTimes(1);

    await userEvent.selectOptions(screen.getByLabelText("Lecturas"), "Normal");

    expect(document.cookie).not.toContain("mock_read_scenario=");
  });

  it("does not invalidate the queries when only the transfer scenario changes", async () => {
    const { invalidate } = renderPanel();
    await openPanel();

    await userEvent.selectOptions(screen.getByLabelText("Envío"), "Éxito");

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("clears both cookies with Restablecer", async () => {
    document.cookie = "mock_scenario=network_error; Path=/";
    document.cookie = "mock_read_scenario=slow; Path=/";
    const { invalidate } = renderPanel();
    await openPanel();

    expect(screen.getByLabelText("Lecturas")).toHaveValue("slow");

    await userEvent.click(screen.getByRole("button", { name: "Restablecer" }));

    expect(document.cookie).not.toContain("mock_scenario=");
    expect(document.cookie).not.toContain("mock_read_scenario=");
    expect(screen.getByLabelText("Envío")).toHaveValue("");
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("collapses again from the pill", async () => {
    renderPanel();
    await openPanel();
    await openPanel();

    expect(screen.queryByLabelText("Envío")).not.toBeInTheDocument();
  });
});

function pill() {
  return screen.getByRole("button", { name: /DEV/ });
}

function panel() {
  return screen.getByRole("region", { name: "Panel DEV" });
}

function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(pill(), {
    clientX: from.x,
    clientY: from.y,
    button: 0,
    pointerId: 1,
  });
  fireEvent.pointerMove(pill(), { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.pointerUp(pill(), { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.click(pill());
}

describe("DevPanel position", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("is draggable below lg, clamps to the viewport and does not toggle after a drag", () => {
    renderPanel();

    expect(pill().className).toContain("dev-panel__pill--draggable");

    drag({ x: 10, y: 10 }, { x: 110, y: 60 });

    expect(panel()).toHaveStyle({ left: "100px", top: "50px" });
    expect(pill()).toHaveAttribute("aria-expanded", "false");

    drag({ x: 0, y: 0 }, { x: -500, y: -500 });

    expect(panel()).toHaveStyle({ left: "8px", top: "8px" });
  });

  it("still toggles on a move shorter than the drag threshold", () => {
    renderPanel();

    drag({ x: 10, y: 10 }, { x: 12, y: 12 });

    expect(pill()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).not.toHaveAttribute("style");
  });

  it("opens the card below the pill when it sits in the top half", () => {
    renderPanel();

    drag({ x: 10, y: 10 }, { x: 110, y: 60 });
    fireEvent.click(pill());

    const card = screen.getByText("Escenarios simulados").parentElement as HTMLElement;
    expect(card.className).toContain("dev-panel__card--below");
    expect(card.className).toContain("dev-panel__card--start");
  });

  it("remembers the position after a remount", () => {
    const { unmount } = renderWithProviders(<DevPanel />);
    drag({ x: 10, y: 10 }, { x: 60, y: 210 });
    unmount();

    renderWithProviders(<DevPanel />);

    expect(panel()).toHaveStyle({ left: "50px", top: "200px" });
  });

  it("stays fixed from lg and ignores a stored position", () => {
    window.localStorage.setItem("smw.dev-panel-position", JSON.stringify({ x: 50, y: 200 }));
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderPanel();

    expect(pill().className).not.toContain("dev-panel__pill--draggable");

    drag({ x: 10, y: 10 }, { x: 110, y: 60 });

    expect(panel()).not.toHaveAttribute("style");
    expect(pill()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Escenarios simulados").parentElement?.className).toContain("dev-panel__card--end");
  });
});
