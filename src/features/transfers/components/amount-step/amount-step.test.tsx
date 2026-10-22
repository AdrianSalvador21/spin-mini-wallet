import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { SESSION_STORAGE_KEY } from "@/shared/lib/session-storage/client-session";
import { server } from "@/test/msw/server";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { DRAFT_STORAGE_VERSION, EMPTY_DRAFT, useTransferDraft } from "../../draft/draft-store";
import { AmountStep } from "./amount-step";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  useTransferDraft.setState(EMPTY_DRAFT);
});

function amountInput() {
  return screen.getByLabelText<HTMLInputElement>("¿Cuánto quieres enviar?");
}

async function renderStep() {
  renderWithProviders(<AmountStep />);

  await screen.findByLabelText("¿Cuánto quieres enviar?");
}

async function waitForBalance() {
  await screen.findByText("Disponible: $12,450.80");
}

function submit() {
  return userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("AmountStep", () => {
  it("formats the amount while typing", async () => {
    await renderStep();

    await userEvent.type(amountInput(), "12450.8");

    expect(amountInput()).toHaveValue("12,450.8");
  });

  it("ignores letters and a third decimal", async () => {
    await renderStep();

    await userEvent.type(amountInput(), "35a0.505");

    expect(amountInput()).toHaveValue("350.50");
  });

  it("sets the amount from a quick chip and the whole balance from Todo", async () => {
    await renderStep();
    await waitForBalance();

    await userEvent.click(screen.getByRole("button", { name: "$500" }));
    expect(amountInput()).toHaveValue("500");
    expect(screen.getByRole("button", { name: "$500" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Todo" }));
    expect(amountInput()).toHaveValue("12,450.80");
  });

  it("shows the minimum amount error for 0", async () => {
    await renderStep();
    await waitForBalance();

    await userEvent.type(amountInput(), "0");
    await submit();

    expect(await screen.findByText("El monto debe ser mayor a cero.")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows the balance message for an amount over the balance", async () => {
    await renderStep();
    await waitForBalance();

    await userEvent.type(amountInput(), "12450.81");
    await submit();

    expect(
      await screen.findByText(
        "El monto supera tu saldo disponible. Escribe una cantidad menor o igual a $12,450.80.",
      ),
    ).toBeInTheDocument();
    expect(amountInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("counts the concept up to 40/40 and stops there", async () => {
    await renderStep();
    const concept = screen.getByLabelText(/Concepto/);

    expect(screen.getByText("0/40")).toBeInTheDocument();

    await userEvent.type(concept, "a".repeat(45));

    expect(concept).toHaveValue("a".repeat(40));
    expect(screen.getByText("40/40")).toBeInTheDocument();
  });

  it("stores the cents and concept and goes to the recipient step", async () => {
    await renderStep();
    await waitForBalance();

    await userEvent.type(amountInput(), "350.5");
    await userEvent.type(screen.getByLabelText(/Concepto/), "Cena viernes");
    await submit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/transfers/new/recipient"));
    expect(useTransferDraft.getState()).toMatchObject({ amountInCents: 35_050, concept: "Cena viernes" });
  });

  it("restores the stored amount and concept after a reload", async () => {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY.TRANSFER_DRAFT,
      JSON.stringify({
        state: { ...EMPTY_DRAFT, amountInCents: 1_245_080 as Cents, concept: "Renta" },
        version: DRAFT_STORAGE_VERSION,
      }),
    );
    await useTransferDraft.persist.rehydrate();

    await renderStep();

    expect(amountInput()).toHaveValue("12,450.80");
    expect(screen.getByLabelText(/Concepto/)).toHaveValue("Renta");
  });

  it("shows the balance error and blocks the submit when the summary fails", async () => {
    server.use(
      http.get("/api/v1/wallet/summary", () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-7" } },
          { status: 503 },
        ),
      ),
    );
    await renderStep();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar tu saldo");
    expect(alert).toHaveTextContent("Referencia: req-7");
    expect(screen.getByRole("button", { name: "Todo" })).toBeDisabled();

    await userEvent.type(amountInput(), "100");
    await submit();

    expect(await screen.findByText("Necesitamos tu saldo para validar el monto.")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("retries the balance from the error alert", async () => {
    let calls = 0;
    server.use(
      http.get("/api/v1/wallet/summary", () => {
        calls += 1;

        return calls === 1
          ? HttpResponse.json(
              { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "r" } },
              { status: 503 },
            )
          : HttpResponse.json({
              user: { id: "usr_mariana", fullName: "Mariana López", maskedPhone: "55 •••• 5678", email: "m@spin.test" },
              balance: { amountInCents: 1_245_080, currency: "MXN" },
            });
      }),
    );
    await renderStep();

    await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    await waitForBalance();
  });
});
