import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { walletQueryKeys } from "@/shared/lib/api/wallet-queries";
import { server } from "@/test/msw/server";
import { renderWithProviders, screen, waitFor, within } from "@/test/render";
import { EMPTY_DRAFT, useTransferDraft } from "../../draft/draft-store";
import { useDraftPreview } from "../../draft/preview-store";
import { TRANSFER_STEP } from "../../draft/types";
import { LiveSummary } from "./live-summary";

const CARLOS = {
  contactId: "ctc_carlos" as ContactId,
  name: "Carlos Ruiz",
  account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
};

beforeEach(() => {
  useTransferDraft.setState({ ...EMPTY_DRAFT, amountInCents: 35_000 as Cents, recipient: CARLOS });
  useDraftPreview.setState({ amountInCents: undefined, recipient: undefined });
});

function termValues() {
  return within(screen.getByRole("complementary"))
    .getAllByRole("term")
    .map((term) => term.textContent);
}

describe("LiveSummary", () => {
  it("shows the amount, the fee and the balance after on the amount step", async () => {
    renderWithProviders(<LiveSummary step={TRANSFER_STEP.AMOUNT} />);

    expect(screen.getByText("$350")).toBeInTheDocument();
    expect(await screen.findByText("$12,100.80")).toBeInTheDocument();
    expect(termValues()).toEqual(["Comisión", "Saldo después"]);
    expect(screen.getByText("Revisarás todo antes de confirmar.")).toBeInTheDocument();
  });

  it("adds the recipient and the masked account on the recipient step", async () => {
    renderWithProviders(<LiveSummary step={TRANSFER_STEP.RECIPIENT} />);

    await screen.findByText("$12,100.80");
    expect(termValues()).toEqual(["Para", "Cuenta", "Comisión", "Saldo después"]);
    expect(screen.getByText("Carlos Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Celular •••• 6789")).toBeInTheDocument();
  });

  it("keeps the Saldo después row before any amount is typed so the summary does not jump", async () => {
    useTransferDraft.setState({ ...EMPTY_DRAFT });

    renderWithProviders(<LiveSummary step={TRANSFER_STEP.AMOUNT} />);

    expect(termValues()).toEqual(["Comisión", "Saldo después"]);
    expect(await screen.findByText("$12,450.80")).toBeInTheDocument();
  });

  it("prefers the in-progress preview over the stored draft", async () => {
    useDraftPreview.setState({
      amountInCents: 10_000 as Cents,
      recipient: { ...CARLOS, contactId: "ctc_ana" as ContactId, name: "Ana Torres" },
    });

    renderWithProviders(<LiveSummary step={TRANSFER_STEP.RECIPIENT} />);

    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(await screen.findByText("$12,350.80")).toBeInTheDocument();
  });

  it("hides the balance after when the balance cannot load", async () => {
    server.use(
      http.get("/api/v1/wallet/summary", () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-1" } },
          { status: 503 },
        ),
      ),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderWithProviders(<LiveSummary step={TRANSFER_STEP.AMOUNT} />, { queryClient });

    await waitFor(() => expect(queryClient.getQueryState(walletQueryKeys.summary())?.status).toBe("error"));
    expect(termValues()).toEqual(["Comisión"]);
  });
});
