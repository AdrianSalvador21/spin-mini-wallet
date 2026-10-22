import { beforeEach, describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import type { UserId } from "@/domain/user/types";
import { clearClientSession, SESSION_STORAGE_KEY } from "@/shared/lib/session-storage/client-session";
import { DRAFT_STORAGE_VERSION, EMPTY_DRAFT, selectDraftState, useTransferDraft } from "./draft-store";
import type { DraftRecipient } from "./types";

const MARIANA = "usr_mariana" as UserId;
const DIEGO = "usr_diego" as UserId;
const CARLOS: DraftRecipient = {
  contactId: "ctc_carlos" as ContactId,
  name: "Carlos Ruiz",
  account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
};
const ANA: DraftRecipient = {
  contactId: "ctc_ana" as ContactId,
  name: "Ana Torres",
  account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, masked: "•••• 5433", bankName: "Banamex" },
};

function draft() {
  return selectDraftState(useTransferDraft.getState());
}

function storedDraft(): { state: unknown; version: number } | null {
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT);

  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  useTransferDraft.setState(EMPTY_DRAFT);
  window.sessionStorage.clear();
});

describe("claim", () => {
  it("stores the owner of an empty draft", () => {
    useTransferDraft.getState().claim(MARIANA);

    expect(draft()).toEqual({ ...EMPTY_DRAFT, ownerId: MARIANA });
  });

  it("keeps the draft when the same owner claims it again", () => {
    useTransferDraft.getState().claim(MARIANA);
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");

    useTransferDraft.getState().claim(MARIANA);

    expect(draft().amountInCents).toBe(5_000);
  });

  it("resets the draft when another owner claims it", () => {
    useTransferDraft.getState().claim(MARIANA);
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");
    useTransferDraft.getState().setRecipient(CARLOS);

    useTransferDraft.getState().claim(DIEGO);

    expect(draft()).toEqual({ ...EMPTY_DRAFT, ownerId: DIEGO });
  });
});

describe("idempotency key", () => {
  it("is stable once created", () => {
    const first = useTransferDraft.getState().ensureIdempotencyKey();
    const second = useTransferDraft.getState().ensureIdempotencyKey();

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
    expect(draft().idempotencyKey).toBe(first);
  });

  it("is cleared when the amount changes", () => {
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");
    useTransferDraft.getState().ensureIdempotencyKey();

    useTransferDraft.getState().setAmount(6_000 as Cents, "Cena");

    expect(draft().idempotencyKey).toBeNull();
  });

  it("is cleared when the concept changes", () => {
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");
    useTransferDraft.getState().ensureIdempotencyKey();

    useTransferDraft.getState().setAmount(5_000 as Cents, "Comida");

    expect(draft().idempotencyKey).toBeNull();
  });

  it("is kept when the same amount and concept are set again", () => {
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");
    const key = useTransferDraft.getState().ensureIdempotencyKey();

    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");

    expect(draft().idempotencyKey).toBe(key);
  });

  it("is cleared when the recipient changes and kept for the same recipient", () => {
    useTransferDraft.getState().setRecipient(CARLOS);
    const key = useTransferDraft.getState().ensureIdempotencyKey();

    useTransferDraft.getState().setRecipient({ ...CARLOS });
    expect(draft().idempotencyKey).toBe(key);

    useTransferDraft.getState().setRecipient(ANA);
    expect(draft().idempotencyKey).toBeNull();
  });
});

describe("reset", () => {
  it("empties the draft", () => {
    useTransferDraft.getState().claim(MARIANA);
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");
    useTransferDraft.getState().setRecipient(CARLOS);

    useTransferDraft.getState().reset();

    expect(draft()).toEqual(EMPTY_DRAFT);
  });
});

describe("persistence", () => {
  it("writes only masked data to sessionStorage with the current version", () => {
    useTransferDraft.getState().claim(MARIANA);
    useTransferDraft.getState().setAmount(1_245_080 as Cents, "Cena");
    useTransferDraft.getState().setRecipient(ANA);

    const stored = storedDraft();

    expect(stored?.version).toBe(DRAFT_STORAGE_VERSION);
    expect(stored?.state).toEqual({
      ownerId: MARIANA,
      amountInCents: 1_245_080,
      concept: "Cena",
      recipient: ANA,
      idempotencyKey: null,
    });
  });

  it("restores a stored draft on rehydrate", async () => {
    const state = { ...EMPTY_DRAFT, ownerId: MARIANA, amountInCents: 5_000, concept: "Cena", recipient: CARLOS };
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY.TRANSFER_DRAFT,
      JSON.stringify({ state, version: DRAFT_STORAGE_VERSION }),
    );

    await useTransferDraft.persist.rehydrate();

    expect(draft()).toEqual(state);
  });

  it("drops a stored draft with another version", async () => {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY.TRANSFER_DRAFT,
      JSON.stringify({ state: { ...EMPTY_DRAFT, amountInCents: 5_000 }, version: DRAFT_STORAGE_VERSION + 1 }),
    );

    await useTransferDraft.persist.rehydrate();

    expect(draft()).toEqual(EMPTY_DRAFT);
    expect(storedDraft()).toEqual({ state: EMPTY_DRAFT, version: DRAFT_STORAGE_VERSION });
  });

  it("is emptied in memory and in storage by clearClientSession", () => {
    useTransferDraft.getState().claim(MARIANA);
    useTransferDraft.getState().setAmount(5_000 as Cents, "Cena");

    clearClientSession();

    expect(draft()).toEqual(EMPTY_DRAFT);
    expect(storedDraft()).toBeNull();
  });
});
