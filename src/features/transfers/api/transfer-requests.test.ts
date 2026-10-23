import { describe, expect, it } from "vitest";
import { buildValidDraft, DRAFT_IDEMPOTENCY_KEY } from "@/test/factories/transfers";
import { buildTransferPayload, transferLookupPath } from "./transfer-requests";

describe("buildTransferPayload", () => {
  it("sends the amount, the contact recipient and the concept", () => {
    expect(buildTransferPayload(buildValidDraft())).toEqual({
      amountInCents: 10_000,
      recipient: { kind: "contact", contactId: "ctc_carlos" },
      concept: "Comida",
    });
  });

  it("omits an empty concept instead of sending an empty string", () => {
    const payload = buildTransferPayload(buildValidDraft({ concept: "" }));

    expect(payload).not.toHaveProperty("concept");
  });

  it("returns equal bodies for equal drafts, so a retry keeps the same payload hash", () => {
    expect(JSON.stringify(buildTransferPayload(buildValidDraft({ concept: "" })))).toBe(
      JSON.stringify(buildTransferPayload(buildValidDraft({ concept: "" }))),
    );
    expect(JSON.stringify(buildTransferPayload(buildValidDraft()))).toBe(
      JSON.stringify(buildTransferPayload(buildValidDraft())),
    );
  });

  it("never sends the idempotency key or the masked account in the body", () => {
    const body = JSON.stringify(buildTransferPayload(buildValidDraft()));

    expect(body).not.toContain(DRAFT_IDEMPOTENCY_KEY);
    expect(body).not.toContain("6789");
  });
});

describe("transferLookupPath", () => {
  it("puts the idempotency key in the query string", () => {
    expect(transferLookupPath("key-1")).toBe("/api/v1/transfers?idempotencyKey=key-1");
  });
});
