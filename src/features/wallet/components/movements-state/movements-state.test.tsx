import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { MovementsState } from "./movements-state";

describe("MovementsState", () => {
  it("renders the title and text without an action", () => {
    renderWithProviders(
      <MovementsState icon={ICON_NAME.INBOX} title="Aún no tienes movimientos" text="Cuando envíes..." />,
    );

    expect(screen.getByText("Aún no tienes movimientos")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the action and calls it, with role alert and the reference", async () => {
    const onAction = vi.fn();
    renderWithProviders(
      <MovementsState
        icon={ICON_NAME.ALERT}
        title="No pudimos cargar tus movimientos"
        text="Intenta de nuevo"
        actionLabel="Reintentar"
        onAction={onAction}
        requestId="req-1"
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-1");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onAction).toHaveBeenCalledOnce();
  });
});
