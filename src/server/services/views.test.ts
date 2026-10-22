import "server-only";
import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import { toMoney, type Cents } from "@/domain/money/money";
import { type TransferId } from "@/domain/transfer/types";
import type { UserId } from "@/domain/user/types";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE, type MovementId } from "@/domain/wallet/types";
import { toContactView, toMovementView, toTransferView, toUserView } from "./views";

const FULL_CLABE = "002180111198765433";
const FULL_CARD = "4111111111111111";
const PASSWORD_HASH = "scrypt$saltbase64$hashbase64";

describe("toUserView", () => {
  it("never exposes the password hash", () => {
    const view = toUserView({
      id: "usr_1" as UserId,
      fullName: "Mariana López",
      phone: "5512345678",
      email: "mariana@spin.test",
      passwordHash: PASSWORD_HASH,
      createdAt: new Date().toISOString(),
    });

    expect(view).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(view)).not.toContain(PASSWORD_HASH);
  });
});

describe("toContactView", () => {
  it("never exposes a full CLABE", () => {
    const view = toContactView({
      id: "ctc_1" as ContactId,
      ownerId: "usr_1" as UserId,
      name: "Ana Torres",
      account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: FULL_CLABE },
      isFavorite: true,
      createdAt: new Date().toISOString(),
    });

    expect(JSON.stringify(view)).not.toContain(FULL_CLABE);
  });

  it("never exposes a full card number", () => {
    const view = toContactView({
      id: "ctc_2" as ContactId,
      ownerId: "usr_1" as UserId,
      name: "Luis García",
      account: { type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: FULL_CARD },
      isFavorite: true,
      createdAt: new Date().toISOString(),
    });

    expect(JSON.stringify(view)).not.toContain(FULL_CARD);
  });
});

describe("toMovementView", () => {
  it("maps the counterparty account to a masked account view", () => {
    const view = toMovementView({
      id: "mov_1" as MovementId,
      userId: "usr_1" as UserId,
      type: MOVEMENT_TYPE.TRANSFER_OUT,
      direction: MOVEMENT_DIRECTION.DEBIT,
      amount: toMoney(1_000 as Cents),
      counterpartyName: "Carlos Ruiz",
      counterpartyAccount: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5523456789" },
      createdAt: new Date().toISOString(),
    });

    expect(view.counterpartyAccount).toEqual({ type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" });
  });

  it("leaves counterpartyAccount undefined when the movement has none", () => {
    const view = toMovementView({
      id: "mov_2" as MovementId,
      userId: "usr_1" as UserId,
      type: MOVEMENT_TYPE.CASH_DEPOSIT,
      direction: MOVEMENT_DIRECTION.CREDIT,
      amount: toMoney(1_000 as Cents),
      merchantName: "OXXO Reforma",
      createdAt: new Date().toISOString(),
    });

    expect(view.counterpartyAccount).toBeUndefined();
  });
});

describe("toTransferView", () => {
  it("never exposes a full card number in the recipient account", () => {
    const view = toTransferView({
      id: "trf_1" as TransferId,
      folio: "SPN-00000001",
      trackingKey: "SPIN26102100000001",
      senderId: "usr_1" as UserId,
      recipient: {
        name: "Luis García",
        account: { type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: FULL_CARD },
      },
      amount: toMoney(1_000 as Cents),
      status: "completed",
      idempotencyKey: "key",
      createdAt: new Date().toISOString(),
    });

    expect(JSON.stringify(view)).not.toContain(FULL_CARD);
  });
});
