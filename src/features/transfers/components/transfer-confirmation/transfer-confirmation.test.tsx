import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { SESSION_STORAGE_KEY } from "@/shared/lib/session-storage/client-session";
import { buildTransfer } from "@/test/factories/transfers";
import { server } from "@/test/msw/server";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { EMPTY_DRAFT, selectDraftState, useTransferDraft } from "../../draft/draft-store";
import type { DraftRecipient } from "../../draft/types";
import { IDLE_SUBMISSION, useSubmissionStore } from "../../submission/submission-store";
import { WizardShell } from "../wizard-shell/wizard-shell";
import { TransferConfirmation } from "./transfer-confirmation";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/transfers/new/review",
  useSearchParams: () => new URLSearchParams(),
}));

const ANA: DraftRecipient = {
  contactId: "ctc_ana" as ContactId,
  name: "Ana Torres",
  account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, masked: "•••• 5433", bankName: "Banamex" },
};

function failWith(status: number, code: string, extra: object = {}) {
  server.use(
    http.post("/api/v1/transfers", () =>
      HttpResponse.json({ error: { code, message: `errors.api.${code}`, requestId: "req-c", ...extra } }, { status }),
    ),
  );
}

function renderConfirmation() {
  return renderWithProviders(
    <WizardShell>
      <TransferConfirmation />
    </WizardShell>,
  );
}

async function confirm() {
  const button = await screen.findByRole("button", { name: "Confirmar envío" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  useSubmissionStore.setState({ state: IDLE_SUBMISSION });
  useTransferDraft.setState({ ...EMPTY_DRAFT, amountInCents: 35_000 as Cents, concept: "Cena", recipient: ANA });
});

afterEach(() => {
  useTransferDraft.setState(EMPTY_DRAFT);
});

describe("TransferConfirmation", () => {
  it("enables Confirmar envío with a valid draft and opens the processing dialog", async () => {
    const pending = Promise.withResolvers<void>();
    server.use(
      http.post("/api/v1/transfers", async () => {
        await pending.promise;

        return HttpResponse.json(buildTransfer(), { status: 201 });
      }),
    );
    renderConfirmation();

    await confirm();

    expect(document.querySelector("dialog")).toHaveAttribute("open");
    expect(screen.getByText("Enviando $350.00 a Ana")).toBeInTheDocument();

    pending.resolve();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/transfers/trf_1"));
  });

  it("hides the app bar, the stepper and Cancelar and shows the outcome on a failure", async () => {
    failWith(503, "UPSTREAM_UNAVAILABLE");
    renderConfirmation();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    await confirm();

    expect(await screen.findByRole("heading", { level: 1, name: "Se perdió la conexión" })).toHaveFocus();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Progreso del envío" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Progreso del envío" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar envío" })).not.toBeInTheDocument();
    expect(document.querySelector("dialog")).not.toBeInTheDocument();
  });

  it("Cambiar monto returns to idle and opens the amount step with the draft intact", async () => {
    failWith(422, "INSUFFICIENT_FUNDS", { balance: { amountInCents: 20_000, currency: "MXN" } });
    renderConfirmation();
    await confirm();
    const key = useTransferDraft.getState().idempotencyKey;

    await userEvent.click(await screen.findByRole("button", { name: "Cambiar monto" }));

    expect(mocks.push).toHaveBeenCalledWith("/transfers/new/amount");
    expect(useSubmissionStore.getState().state).toEqual({ status: "idle" });
    expect(useTransferDraft.getState()).toMatchObject({ amountInCents: 35_000, recipient: ANA, idempotencyKey: key });
  });

  it("keeps the draft and its key when leaving a failed outcome through Volver al inicio", async () => {
    failWith(500, "INTERNAL_ERROR");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = renderConfirmation();
    await confirm();
    const key = useTransferDraft.getState().idempotencyKey;

    expect(await screen.findByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/home");
    unmount();

    expect(useSubmissionStore.getState().state).toEqual({ status: "idle" });
    expect(useTransferDraft.getState().idempotencyKey).toBe(key);
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT)).toContain(key as string);
    vi.restoreAllMocks();
  });

  it("resets the draft only once it unmounts after a success", async () => {
    const { unmount } = renderConfirmation();

    await confirm();
    await waitFor(() => expect(useSubmissionStore.getState().state.status).toBe("succeeded"));

    expect(useTransferDraft.getState().amountInCents).toBe(35_000);
    expect(document.querySelector("dialog")).toHaveAttribute("open");

    unmount();

    expect(selectDraftState(useTransferDraft.getState())).toEqual(EMPTY_DRAFT);
    expect(useSubmissionStore.getState().state).toEqual({ status: "idle" });
  });
});
