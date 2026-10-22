import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import type { UserId } from "@/domain/user/types";
import { renderWithProviders, screen, waitFor, within } from "@/test/render";
import { EMPTY_DRAFT, selectDraftState, useTransferDraft } from "../../draft/draft-store";
import { WizardShell } from "./wizard-shell";

const pathnameMock = vi.fn(() => "/transfers/new/amount");
const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useSearchParams: () => searchParamsMock(),
}));

function renderShell() {
  return renderWithProviders(
    <WizardShell>
      <p>Contenido del paso</p>
    </WizardShell>,
  );
}

beforeEach(() => {
  pathnameMock.mockReturnValue("/transfers/new/amount");
  searchParamsMock.mockReturnValue(new URLSearchParams());
  useTransferDraft.setState(EMPTY_DRAFT);
});

describe("WizardShell", () => {
  it.each([
    ["/transfers/new/amount", "Enviar dinero", "1 de 3", "/home"],
    ["/transfers/new/recipient", "¿A quién le envías?", "2 de 3", "/transfers/new/amount"],
    ["/transfers/new/review", "Revisa tu envío", "3 de 3", "/transfers/new/recipient"],
  ])("on %s shows the mobile title, counter and back link", (pathname, title, counter, backHref) => {
    pathnameMock.mockReturnValue(pathname);

    renderShell();

    const appBar = screen.getByRole("banner");
    expect(within(appBar).getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(within(appBar).getByText(counter)).toBeInTheDocument();
    expect(within(appBar).getByRole("link", { name: "Regresar" })).toHaveAttribute("href", backHref);
  });

  it("titles the new-recipient form and goes back to the list from it", () => {
    pathnameMock.mockReturnValue("/transfers/new/recipient");
    searchParamsMock.mockReturnValue(new URLSearchParams("mode=new"));

    renderShell();

    const appBar = screen.getByRole("banner");
    expect(within(appBar).getByRole("heading", { level: 1 })).toHaveTextContent("Nuevo destinatario");
    expect(within(appBar).getByRole("link", { name: "Regresar" })).toHaveAttribute("href", "/transfers/new/recipient");
    expect(screen.getByRole("heading", { level: 2, name: "Nuevo destinatario" })).toBeInTheDocument();
  });

  it("moves focus to the heading when the new-recipient form opens", () => {
    pathnameMock.mockReturnValue("/transfers/new/recipient");
    const { rerender } = renderShell();

    searchParamsMock.mockReturnValue(new URLSearchParams("mode=new"));
    rerender(
      <WizardShell>
        <p>Contenido del paso</p>
      </WizardShell>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Nuevo destinatario" })).toHaveFocus();
  });

  it("exposes the progress of the current step", () => {
    pathnameMock.mockReturnValue("/transfers/new/recipient");

    renderShell();

    expect(screen.getByRole("progressbar", { name: "Progreso del envío" })).toHaveAttribute("aria-valuenow", "2");
  });

  it("links only the completed steps in the desktop stepper", () => {
    pathnameMock.mockReturnValue("/transfers/new/review");

    renderShell();

    const stepper = screen.getByRole("list", { name: "Progreso del envío" });
    const links = within(stepper).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/transfers/new/amount",
      "/transfers/new/recipient",
    ]);
    expect(within(stepper).getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");
  });

  it("renders the live summary on the amount and recipient steps only", () => {
    const { unmount } = renderShell();

    expect(screen.getByRole("complementary", { name: "Resumen" })).toBeInTheDocument();
    unmount();

    pathnameMock.mockReturnValue("/transfers/new/review");
    renderShell();

    expect(screen.queryByRole("complementary", { name: "Resumen" })).not.toBeInTheDocument();
  });

  it("always renders the step content so the route segment is never dropped", () => {
    renderShell();

    expect(screen.getByText("Contenido del paso")).toBeInTheDocument();
  });

  it("resets the draft when Cancelar is pressed", async () => {
    useTransferDraft.setState({
      amountInCents: 5_000 as Cents,
      concept: "Cena",
      recipient: {
        contactId: "ctc_carlos" as ContactId,
        name: "Carlos Ruiz",
        account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
      },
    });
    renderShell();

    const cancel = screen.getByRole("link", { name: "Cancelar" });
    expect(cancel).toHaveAttribute("href", "/home");
    cancel.addEventListener("click", (event) => event.preventDefault());

    await userEvent.click(cancel);

    expect(selectDraftState(useTransferDraft.getState())).toMatchObject({
      amountInCents: null,
      concept: "",
      recipient: null,
    });
  });

  it("claims the draft for the signed-in user", async () => {
    useTransferDraft.setState({ ownerId: "usr_other" as UserId, amountInCents: 5_000 as Cents });

    renderShell();

    await waitFor(() => expect(useTransferDraft.getState().ownerId).toBe("usr_mariana"));
    expect(useTransferDraft.getState().amountInCents).toBeNull();
  });

  it("moves focus to the step heading when the step changes", async () => {
    const { rerender } = renderShell();

    expect(screen.getByRole("heading", { level: 2, name: "Enviar dinero" })).not.toHaveFocus();

    pathnameMock.mockReturnValue("/transfers/new/recipient");
    rerender(
      <WizardShell>
        <p>Contenido del paso</p>
      </WizardShell>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "¿A quién le envías?" })).toHaveFocus();
  });
});
