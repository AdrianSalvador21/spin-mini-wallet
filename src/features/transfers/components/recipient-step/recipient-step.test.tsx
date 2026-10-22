import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { server } from "@/test/msw/server";
import { renderWithProviders, screen, waitFor, within } from "@/test/render";
import { EMPTY_DRAFT, useTransferDraft } from "../../draft/draft-store";
import { RecipientStep } from "./recipient-step";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const UNAVAILABLE = { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-c" } };

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  window.history.replaceState(null, "", "/transfers/new/recipient");
  useTransferDraft.setState({ ...EMPTY_DRAFT, amountInCents: 35_000 as Cents });
});

function submit() {
  return userEvent.click(screen.getByRole("button", { name: /^Continuar/ }));
}

describe("RecipientStep", () => {
  it("lists the four favorites in name order", async () => {
    renderWithProviders(<RecipientStep />);

    const group = await screen.findByRole("radiogroup", { name: "Contactos favoritos" });
    const radios = within(group).getAllByRole("radio");

    expect(radios).toHaveLength(4);
    ["Ana Torres", "Carlos Ruiz", "Diego Ramírez", "Luis García"].forEach((name, index) => {
      expect(radios[index]).toHaveAccessibleName(new RegExp(`^${name}`));
    });
    expect(screen.getByRole("heading", { name: "Tus favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar nuevo destinatario" })).toBeInTheDocument();
  });

  it("shows three skeleton rows while the contacts load", () => {
    renderWithProviders(<RecipientStep />);

    expect(screen.getAllByTestId("contact-skeleton")).toHaveLength(3);
  });

  it("shows the empty state with a way to add a recipient", async () => {
    server.use(http.get("/api/v1/contacts", () => HttpResponse.json({ items: [] })));

    renderWithProviders(<RecipientStep />);

    expect(await screen.findByText("Aún no tienes contactos guardados")).toBeInTheDocument();
    expect(screen.getByText("Agrega a alguien para enviarle dinero.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar nuevo destinatario" })).toBeInTheDocument();
  });

  it("shows the error with its reference and loads the list on retry", async () => {
    let calls = 0;
    server.use(
      http.get("/api/v1/contacts", () => {
        calls += 1;

        return calls === 1
          ? HttpResponse.json(UNAVAILABLE, { status: 503 })
          : HttpResponse.json({ items: [{ id: "ctc_ana", name: "Ana Torres", account: { type: "phone", masked: "•••• 1234" }, isFavorite: true }] });
      }),
    );

    renderWithProviders(<RecipientStep />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar tus contactos");
    expect(alert).toHaveTextContent("Referencia: req-c");
    expect(screen.getByRole("button", { name: "Agregar nuevo destinatario" })).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("radio", { name: /Ana Torres/ })).toBeInTheDocument();
  });

  it("requires a recipient before continuing", async () => {
    renderWithProviders(<RecipientStep />);
    await screen.findByRole("radiogroup");

    await submit();

    expect(await screen.findByText("Selecciona o agrega un destinatario.")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toHaveAccessibleDescription("Selecciona o agrega un destinatario.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("names Carlos in the CTA and stores only his masked account", async () => {
    renderWithProviders(<RecipientStep />);

    await userEvent.click(await screen.findByRole("radio", { name: /Carlos Ruiz/ }));

    expect(screen.getByText("Continuar con Carlos")).toBeInTheDocument();

    await submit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/transfers/new/review"));
    expect(useTransferDraft.getState().recipient).toEqual({
      contactId: "ctc_carlos",
      name: "Carlos Ruiz",
      account: { type: "phone", masked: "•••• 6789" },
    });
  });

  it("opens the new-recipient form with ?mode=new", async () => {
    renderWithProviders(<RecipientStep />);

    await userEvent.click(await screen.findByRole("button", { name: "Agregar nuevo destinatario" }));

    expect(window.location.search).toBe("?mode=new");
  });

  it("redirects to the amount step when the draft has no amount", async () => {
    useTransferDraft.setState(EMPTY_DRAFT);

    renderWithProviders(<RecipientStep />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/transfers/new/amount"));
  });
});
