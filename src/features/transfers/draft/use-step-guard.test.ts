import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { SESSION_STORAGE_KEY } from "@/shared/lib/session-storage/client-session";
import { DRAFT_STORAGE_VERSION, EMPTY_DRAFT, useTransferDraft } from "./draft-store";
import { TRANSFER_STEP } from "./types";
import { useStepGuard } from "./use-step-guard";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function storeDraft(state: object) {
  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY.TRANSFER_DRAFT,
    JSON.stringify({ state: { ...EMPTY_DRAFT, ...state }, version: DRAFT_STORAGE_VERSION }),
  );
}

beforeEach(() => {
  replaceMock.mockReset();
  useTransferDraft.setState(EMPTY_DRAFT);
});

describe("useStepGuard", () => {
  it("waits for the stored draft before allowing the step or redirecting", async () => {
    storeDraft({ amountInCents: 5_000 });

    const { result } = renderHook(() => useStepGuard(TRANSFER_STEP.RECIPIENT));

    await waitFor(() => expect(result.current).toBe(true));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects the review to the amount step when the draft is empty", async () => {
    await useTransferDraft.persist.rehydrate();

    const { result } = renderHook(() => useStepGuard(TRANSFER_STEP.REVIEW));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/transfers/new/amount"));
    expect(result.current).toBe(false);
  });

  it("redirects the review to the recipient step when only the amount is set", async () => {
    useTransferDraft.setState({ amountInCents: 5_000 as Cents });

    renderHook(() => useStepGuard(TRANSFER_STEP.REVIEW));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/transfers/new/recipient"));
  });

  it("allows the review when the draft is complete", async () => {
    useTransferDraft.setState({
      amountInCents: 5_000 as Cents,
      recipient: {
        contactId: "ctc_carlos" as ContactId,
        name: "Carlos Ruiz",
        account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
      },
    });

    const { result } = renderHook(() => useStepGuard(TRANSFER_STEP.REVIEW));

    expect(result.current).toBe(true);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
