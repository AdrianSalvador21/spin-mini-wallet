import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ALERT_ROLE } from "@/shared/ui/alert/types";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { renderWithProviders, screen } from "@/test/render";
import { WizardState } from "./wizard-state";

describe("WizardState", () => {
  it("renders the title, text and action", async () => {
    const onAction = vi.fn();
    renderWithProviders(
      <WizardState
        icon={ICON_NAME.USERS}
        title="Aún no tienes contactos guardados"
        text="Agrega a alguien para enviarle dinero."
        actionLabel="Agregar nuevo destinatario"
        onAction={onAction}
      />,
    );

    expect(screen.getByText("Aún no tienes contactos guardados")).toBeInTheDocument();
    expect(screen.getByText("Agrega a alguien para enviarle dinero.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Agregar nuevo destinatario" }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it("exposes an error with its role and reference", () => {
    renderWithProviders(
      <WizardState
        icon={ICON_NAME.ALERT}
        title="No pudimos cargar tus contactos"
        role={ALERT_ROLE.ALERT}
        requestId="req-1"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: req-1");
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Copiar referencia",
    ]);
  });
});
