import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { MARIANA_PHONE } from "@/test/factories/contacts";
import { server } from "@/test/msw/server";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { EMPTY_DRAFT, useTransferDraft } from "../../draft/draft-store";
import { RecipientStep } from "../recipient-step/recipient-step";
import { NewRecipientForm } from "./new-recipient-form";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const VALID_CLABE = "002123456789012343";

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  window.history.replaceState(null, "", "/transfers/new/recipient?mode=new");
  useTransferDraft.setState({ ...EMPTY_DRAFT, amountInCents: 35_000 as Cents });
});

function nameField() {
  return screen.getByLabelText("Nombre del destinatario");
}

function submit() {
  return userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("NewRecipientForm", () => {
  it("replaces the list when the URL has ?mode=new and links back to the list", async () => {
    renderWithProviders(<RecipientStep />);

    expect(await screen.findByLabelText("Nombre del destinatario")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Contactos favoritos" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute("href", "/transfers/new/recipient");
  });

  it("shows the list again without ?mode=new", async () => {
    window.history.replaceState(null, "", "/transfers/new/recipient");

    renderWithProviders(<RecipientStep />);

    expect(await screen.findByRole("radiogroup", { name: "Contactos favoritos" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre del destinatario")).not.toBeInTheDocument();
  });

  it("swaps the account field by type and keeps the name", async () => {
    renderWithProviders(<NewRecipientForm />);

    expect(screen.getByLabelText("Número celular")).toHaveAttribute("inputmode", "tel");
    await userEvent.type(nameField(), "Beatriz Soto");

    await userEvent.click(screen.getByRole("radio", { name: "CLABE" }));

    expect(screen.queryByLabelText("Número celular")).not.toBeInTheDocument();
    expect(screen.getByLabelText("CLABE interbancaria")).toHaveAttribute("inputmode", "numeric");
    expect(nameField()).toHaveValue("Beatriz Soto");

    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));

    expect(screen.getByLabelText("Número de tarjeta")).toBeInTheDocument();
  });

  it("detects the bank of a CLABE", async () => {
    renderWithProviders(<NewRecipientForm />);
    await userEvent.click(screen.getByRole("radio", { name: "CLABE" }));

    await userEvent.type(screen.getByLabelText("CLABE interbancaria"), VALID_CLABE);

    expect(screen.getByText("Banco detectado: Banamex")).toBeInTheDocument();
  });

  it("shows CARD_INVALID_CHECKSUM for an invalid card", async () => {
    renderWithProviders(<NewRecipientForm />);
    await userEvent.type(nameField(), "Beatriz Soto");
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    await userEvent.type(screen.getByLabelText("Número de tarjeta"), "4111111111111112");

    await submit();

    expect(await screen.findByText("Revisa el número de tarjeta, parece incorrecto.")).toBeInTheDocument();
  });

  it("stores the saved contact as the masked draft recipient and goes to the review", async () => {
    renderWithProviders(<NewRecipientForm />);
    await userEvent.type(nameField(), "Beatriz Soto");
    await userEvent.click(screen.getByRole("radio", { name: "CLABE" }));
    await userEvent.type(screen.getByLabelText("CLABE interbancaria"), VALID_CLABE);

    await submit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/transfers/new/review"));
    expect(useTransferDraft.getState().recipient).toEqual({
      contactId: "ctc_new",
      name: "Beatriz Soto",
      account: { type: "clabe", masked: "•••• 2343", bankName: "Banamex" },
    });
  });

  it("puts RECIPIENT_IS_SELF on the phone field", async () => {
    renderWithProviders(<NewRecipientForm />);
    await userEvent.type(nameField(), "Mariana López");
    await userEvent.type(screen.getByLabelText("Número celular"), MARIANA_PHONE);

    await submit();

    expect(await screen.findByText("No puedes enviarte dinero a ti mismo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Número celular")).toHaveAccessibleDescription("No puedes enviarte dinero a ti mismo.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows the save error with a retry and keeps the typed values", async () => {
    let calls = 0;
    server.use(
      http.post("/api/v1/contacts", () => {
        calls += 1;

        return calls === 1
          ? HttpResponse.json(
              { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-s" } },
              { status: 503 },
            )
          : HttpResponse.json(
              { id: "ctc_beatriz", name: "Beatriz Soto", account: { type: "phone", masked: "•••• 9999" }, isFavorite: true },
              { status: 201 },
            );
      }),
    );
    renderWithProviders(<NewRecipientForm />);
    await userEvent.type(nameField(), "Beatriz Soto");
    await userEvent.type(screen.getByLabelText("Número celular"), "5599999999");

    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos guardar el contacto.");
    expect(alert).toHaveTextContent("Referencia: req-s");
    expect(nameField()).toHaveValue("Beatriz Soto");
    expect(screen.getByLabelText("Número celular")).toHaveValue("55 9999 9999");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/transfers/new/review"));
  });

  it("sends saveAsFavorite false when the box is unchecked", async () => {
    let body: unknown;
    server.use(
      http.post("/api/v1/contacts", async ({ request }) => {
        body = await request.json();

        return HttpResponse.json(
          { id: "ctc_beatriz", name: "Beatriz Soto", account: { type: "phone", masked: "•••• 9999" }, isFavorite: false },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<NewRecipientForm />);
    await userEvent.type(nameField(), "Beatriz Soto");
    await userEvent.type(screen.getByLabelText("Número celular"), "5599999999");

    expect(screen.getByRole("checkbox", { name: "Guardar en favoritos" })).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "Guardar en favoritos" }));
    await submit();

    await waitFor(() => expect(body).toMatchObject({ saveAsFavorite: false }));
  });
});
