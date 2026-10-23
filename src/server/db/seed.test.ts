import "server-only";
import { describe, expect, it } from "vitest";
import { detectBank } from "@/domain/contact/banks";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import { validateRecipientAccount } from "@/domain/contact/validators";
import { maskAccount } from "@/domain/contact/mask";
import { MOVEMENT_TYPE } from "@/domain/wallet/types";
import { verifyPassword } from "../session/password";
import { createSeed } from "./seed";

const NOW = new Date("2026-10-21T00:00:00.000Z");

describe("createSeed", () => {
  it("creates Mariana and Diego", async () => {
    const snapshot = await createSeed(NOW);

    expect(snapshot.users.map((user) => user.fullName).sort()).toEqual(["Diego Ramírez", "Mariana López"]);
  });

  it("gives Mariana a balance of 1245080 cents and 25 movements covering every type", async () => {
    const snapshot = await createSeed(NOW);
    const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");
    const wallet = snapshot.wallets.find((entry) => entry.userId === mariana?.id);
    const movements = snapshot.movements.filter((movement) => movement.userId === mariana?.id);

    expect(wallet?.balance.amountInCents).toBe(1245080);
    expect(movements).toHaveLength(25);
    expect(new Set(movements.map((movement) => movement.type))).toEqual(new Set(Object.values(MOVEMENT_TYPE)));
  });

  it("gives Diego a balance of 50000 cents and no movements", async () => {
    const snapshot = await createSeed(NOW);
    const diego = snapshot.users.find((user) => user.fullName === "Diego Ramírez");
    const wallet = snapshot.wallets.find((entry) => entry.userId === diego?.id);
    const movements = snapshot.movements.filter((movement) => movement.userId === diego?.id);

    expect(wallet?.balance.amountInCents).toBe(50000);
    expect(movements).toHaveLength(0);
  });

  it("creates 4 favorites for Mariana whose accounts pass domain validation", async () => {
    const snapshot = await createSeed(NOW);

    expect(snapshot.contacts).toHaveLength(4);
    expect(snapshot.contacts.every((contact) => contact.isFavorite)).toBe(true);

    for (const contact of snapshot.contacts) {
      expect(validateRecipientAccount(contact.account).ok).toBe(true);
    }

    const ana = snapshot.contacts.find((contact) => contact.name === "Ana Torres");
    expect(ana?.account.type).toBe(RECIPIENT_ACCOUNT_TYPE.CLABE);

    if (ana?.account.type === RECIPIENT_ACCOUNT_TYPE.CLABE) {
      expect(detectBank(ana.account.clabe)).toBe("Banamex");
    }
  });

  it("gives every transfer_out movement a counterpartyAccount masked to at most 4 digits", async () => {
    const snapshot = await createSeed(NOW);
    const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");
    const transferOuts = snapshot.movements.filter(
      (movement) => movement.userId === mariana?.id && movement.type === MOVEMENT_TYPE.TRANSFER_OUT,
    );

    expect(transferOuts.length).toBeGreaterThan(0);

    for (const movement of transferOuts) {
      expect(movement.counterpartyAccount).toBeDefined();

      if (movement.counterpartyAccount) {
        const masked = maskAccount(movement.counterpartyAccount);
        expect(masked.replace(/\D/g, "")).toHaveLength(4);
      }
    }
  });

  it("creates verifiable passwords for both seed users", async () => {
    const snapshot = await createSeed(NOW);

    for (const user of snapshot.users) {
      expect(await verifyPassword("Spin2026", user.passwordHash)).toBe(true);
    }
  });
});
