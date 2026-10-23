import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { SESSION_STORAGE_KEY } from "@/shared/lib/session-storage/client-session";
import { buildWalletSummary } from "@/test/factories/wallet";
import { server } from "@/test/msw/server";
import { renderWithProviders, screen, waitFor, within } from "@/test/render";
import { DRAFT_STORAGE_VERSION, EMPTY_DRAFT, useTransferDraft } from "../../draft/draft-store";
import type { DraftRecipient } from "../../draft/types";
import { ReviewStep } from "./review-step";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

const ANA: DraftRecipient = {
  contactId: "ctc_ana" as ContactId,
  name: "Ana Torres",
  account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, masked: "•••• 5433", bankName: "Banamex" },
};

const DRAFT = { ...EMPTY_DRAFT, amountInCents: 35_000 as Cents, concept: "Cena viernes", recipient: ANA };

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  useTransferDraft.setState(DRAFT);
});

function summaryRows() {
  const list = screen.getAllByRole("term")[0].closest("dl") as HTMLElement;

  return within(list)
    .getAllByRole("term")
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

async function renderReview(onConfirm: () => void = vi.fn()) {
  renderWithProviders(<ReviewStep onConfirm={onConfirm} />);

  await screen.findByText("$12,100.80");
}

describe("ReviewStep", () => {
  it("shows the recipient, masked account, concept, fee and balance after", async () => {
    await renderReview();

    expect(screen.getByText("Vas a enviar")).toBeInTheDocument();
    expect(screen.getByText("$350")).toBeInTheDocument();
    expect(summaryRows()).toEqual([
      ["Para", "Ana Torres"],
      ["Cuenta", "CLABE •••• 5433Banamex"],
      ["Concepto", "Cena viernes"],
      ["Comisión", "$0.00"],
      ["Saldo después", "$12,100.80"],
    ]);
  });

  it("hides the concept row when the concept is empty", async () => {
    useTransferDraft.setState({ ...DRAFT, concept: "" });

    await renderReview();

    expect(summaryRows().map(([label]) => label)).toEqual(["Para", "Cuenta", "Comisión", "Saldo después"]);
  });

  it("creates one idempotency key on entry and keeps it after a reload", async () => {
    await renderReview();

    const key = useTransferDraft.getState().idempotencyKey;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);

    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT) ?? "{}";
    expect(JSON.parse(raw)).toMatchObject({ version: DRAFT_STORAGE_VERSION, state: { idempotencyKey: key } });

    useTransferDraft.setState(EMPTY_DRAFT);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT, raw);
    await useTransferDraft.persist.rehydrate();

    expect(useTransferDraft.getState().idempotencyKey).toBe(key);
  });

  it("blocks the confirmation when the balance dropped below the amount", async () => {
    server.use(
      http.get("/api/v1/wallet/summary", () =>
        HttpResponse.json(buildWalletSummary({ balance: { amountInCents: 10_000 as Cents, currency: "MXN" } })),
      ),
    );
    const onConfirm = vi.fn();
    renderWithProviders(<ReviewStep onConfirm={onConfirm} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo cambió desde que empezaste:");
    expect(alert).toHaveTextContent("El monto supera tu saldo disponible. Escribe una cantidad menor o igual a $100.00.");
    expect(within(alert).getByRole("link", { name: "Corregir" })).toHaveAttribute("href", "/transfers/new/amount");
    expect(screen.getByRole("button", { name: "Confirmar envío" })).toBeDisabled();
  });

  it("enables Confirmar envío with a valid draft and no longer shows the SPEC 07 note", async () => {
    await renderReview();

    expect(screen.getByRole("button", { name: "Confirmar envío" })).toBeEnabled();
    expect(screen.queryByText(/Pronto podrás confirmar/)).not.toBeInTheDocument();
  });

  it("hands the valid draft to onConfirm when one is given", async () => {
    const onConfirm = vi.fn();
    await renderReview(onConfirm);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));

    expect(onConfirm).toHaveBeenCalledWith({
      amountInCents: 35_000,
      concept: "Cena viernes",
      recipient: ANA,
      idempotencyKey: useTransferDraft.getState().idempotencyKey,
    });
  });

  it("links Editar datos to the amount step and keeps the draft", async () => {
    await renderReview();

    expect(screen.getByRole("link", { name: "Editar datos" })).toHaveAttribute("href", "/transfers/new/amount");
    expect(useTransferDraft.getState()).toMatchObject({ amountInCents: 35_000, concept: "Cena viernes" });
  });

  it("redirects to the recipient step when the draft has no recipient", async () => {
    useTransferDraft.setState({ ...DRAFT, recipient: null });

    renderWithProviders(<ReviewStep onConfirm={vi.fn()} />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/transfers/new/recipient"));
  });

  it("shows the balance error and hides the balance after when the summary fails", async () => {
    server.use(
      http.get("/api/v1/wallet/summary", () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-r" } },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<ReviewStep onConfirm={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tu saldo");
    expect(summaryRows().map(([label]) => label)).not.toContain("Saldo después");
    expect(screen.getByRole("button", { name: "Confirmar envío" })).toBeDisabled();
  });
});
