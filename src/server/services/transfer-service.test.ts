import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { TRANSFER_RECIPIENT_KIND, type TransferId, type TransferRecipientInput } from "@/domain/transfer/types";
import type { UserId } from "@/domain/user/types";
import { createJsonDatabase } from "../db/json-database";
import { SCHEMA_VERSION, type DatabaseSnapshot } from "../db/schema";
import { createSeed } from "../db/seed";
import type { ServiceDependencies } from "./types";
import { createTransferService, type TransferService } from "./transfer-service";

const NOW = new Date("2026-10-21T12:00:00.000Z");

const NEW_RECIPIENT: TransferRecipientInput = {
  kind: TRANSFER_RECIPIENT_KIND.NEW,
  name: "Carlos Ruiz",
  account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5523456789" },
  saveAsFavorite: false,
};

let tempDir: string;
let service: TransferService;
let deps: ServiceDependencies;
let marianaId: UserId;
let diegoId: UserId;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-transfers-"));
  const dbPath = join(tempDir, "db.json");
  const db = createJsonDatabase(dbPath, () => createSeed(NOW));
  let idCounter = 0;
  deps = { db, now: () => NOW, random: () => 0.4, createId: () => `id${idCounter++}` };
  service = createTransferService(deps);

  const snapshot = await createSeed(NOW);
  const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");
  const diego = snapshot.users.find((user) => user.fullName === "Diego Ramírez");

  if (!mariana || !diego) {
    throw new Error("Seed is missing an expected user");
  }

  marianaId = mariana.id;
  diegoId = diego.id;
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("TransferService.create", () => {
  it("debits the sender and stores the transfer", async () => {
    const result = await service.create(
      marianaId,
      { amountInCents: 10_000, recipient: NEW_RECIPIENT },
      "key-1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.status).toBe("completed");
    expect(result.value.folio).toMatch(/^SPN-\d{8}$/);
    expect(result.value.trackingKey).toMatch(/^SPIN\d{14}$/);

    const summary = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(summary?.balance.amountInCents).toBe(1_245_080 - 10_000);

    const movements = await deps.db.read((repositories) => repositories.movements.listByUserId(marianaId));
    const transferOut = movements.find((movement) => movement.transferId === result.value.id);
    expect(transferOut?.counterpartyName).toBe("Carlos Ruiz");
    expect(transferOut?.counterpartyAccount).toEqual(NEW_RECIPIENT.account);
  });

  it("returns VALIDATION_ERROR when the amount is not positive", async () => {
    const result = await service.create(marianaId, { amountInCents: 0, recipient: NEW_RECIPIENT }, "key-2");

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { amountInCents: ["AMOUNT_NOT_POSITIVE"] } },
    });
  });

  it("returns INSUFFICIENT_FUNDS with the current balance", async () => {
    const result = await service.create(
      marianaId,
      { amountInCents: 1_245_080 + 1, recipient: NEW_RECIPIENT },
      "key-3",
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "INSUFFICIENT_FUNDS", balance: { amountInCents: 1_245_080, currency: "MXN" } },
    });
  });

  it("succeeds for an amount equal to the balance and leaves it at 0", async () => {
    const result = await service.create(
      marianaId,
      { amountInCents: 1_245_080, recipient: NEW_RECIPIENT },
      "key-4",
    );

    expect(result.ok).toBe(true);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(0);
  });

  it("replays the same transfer for a repeated idempotency key and payload", async () => {
    const first = await service.create(marianaId, { amountInCents: 10_000, recipient: NEW_RECIPIENT }, "key-5");
    const second = await service.create(marianaId, { amountInCents: 10_000, recipient: NEW_RECIPIENT }, "key-5");

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(second.value.id).toBe(first.value.id);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(1_245_080 - 10_000);
  });

  it("returns IDEMPOTENCY_CONFLICT for the same key with a different payload", async () => {
    await service.create(marianaId, { amountInCents: 10_000, recipient: NEW_RECIPIENT }, "key-6");
    const result = await service.create(marianaId, { amountInCents: 20_000, recipient: NEW_RECIPIENT }, "key-6");

    expect(result).toEqual({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("returns NOT_FOUND for a contact that does not belong to the sender", async () => {
    const result = await service.create(
      marianaId,
      {
        amountInCents: 10_000,
        recipient: { kind: TRANSFER_RECIPIENT_KIND.CONTACT, contactId: "ctc_does_not_exist" },
      },
      "key-7",
    );

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("allows exactly 5 of 10 concurrent $2,000.00 transfers on a $10,000.00 balance", async () => {
    const concurrentTempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-transfers-concurrent-"));
    const concurrentDbPath = join(concurrentTempDir, "db.json");
    const userId = "usr_concurrent" as UserId;

    const buildStubSeed = (): DatabaseSnapshot => ({
      schemaVersion: SCHEMA_VERSION,
      users: [
        {
          id: userId,
          fullName: "Usuario Concurrente",
          phone: "5500000001",
          email: "concurrente@spin.test",
          passwordHash: "unused",
          createdAt: NOW.toISOString(),
        },
      ],
      wallets: [
        { userId, balance: { amountInCents: 1_000_000 as Cents, currency: "MXN" }, updatedAt: NOW.toISOString() },
      ],
      movements: [],
      contacts: [],
      transfers: [],
      idempotencyKeys: [],
    });

    let idCounter = 0;
    const concurrentDeps: ServiceDependencies = {
      db: createJsonDatabase(concurrentDbPath, buildStubSeed),
      now: () => NOW,
      random: () => 0.4,
      createId: () => `cid${idCounter++}`,
    };
    const concurrentService = createTransferService(concurrentDeps);

    const attempts = Array.from({ length: 10 }, (_, index) =>
      concurrentService.create(
        userId,
        { amountInCents: 200_000, recipient: NEW_RECIPIENT },
        `concurrent-key-${index}`,
      ),
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((result) => result.ok);

    expect(successes).toHaveLength(5);

    const wallet = await concurrentDeps.db.read((repositories) => repositories.wallets.findByUserId(userId));
    expect(wallet?.balance.amountInCents).toBe(0);

    await rm(concurrentTempDir, { recursive: true, force: true });
  });
});

describe("TransferService.create self-transfer, P2P credit and favorites", () => {
  it("returns RECIPIENT_IS_SELF when sending to one's own phone", async () => {
    const result = await service.create(
      marianaId,
      {
        amountInCents: 10_000,
        recipient: {
          kind: TRANSFER_RECIPIENT_KIND.NEW,
          name: "Mariana López",
          account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" },
          saveAsFavorite: false,
        },
      },
      "self-key",
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { recipient: ["RECIPIENT_IS_SELF"] } },
    });
  });

  it("credits Diego's wallet and creates his transfer_in when Mariana sends to his phone", async () => {
    const result = await service.create(
      marianaId,
      {
        amountInCents: 5_000,
        recipient: {
          kind: TRANSFER_RECIPIENT_KIND.NEW,
          name: "Diego Ramírez",
          account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5587654321" },
          saveAsFavorite: false,
        },
      },
      "p2p-key",
    );

    expect(result.ok).toBe(true);

    const diegoWallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(diegoId));
    expect(diegoWallet?.balance.amountInCents).toBe(50_000 + 5_000);

    const diegoMovements = await deps.db.read((repositories) => repositories.movements.listByUserId(diegoId));
    const credit = diegoMovements.find((movement) => movement.type === "transfer_in");
    expect(credit?.counterpartyName).toBe("Mariana López");
    expect(credit?.direction).toBe("credit");
    expect(credit?.counterpartyAccount).toEqual({
      type: RECIPIENT_ACCOUNT_TYPE.PHONE,
      phone: "5512345678",
    });
  });

  it("only debits the sender for a CLABE recipient, even if it belongs to a registered account holder", async () => {
    const result = await service.create(
      marianaId,
      {
        amountInCents: 5_000,
        recipient: {
          kind: TRANSFER_RECIPIENT_KIND.NEW,
          name: "Ana Torres",
          account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: "002180111198765433" },
          saveAsFavorite: false,
        },
      },
      "clabe-key",
    );

    expect(result.ok).toBe(true);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(1_245_080 - 5_000);
  });

  it("only debits the sender for a card recipient", async () => {
    const result = await service.create(
      marianaId,
      {
        amountInCents: 5_000,
        recipient: {
          kind: TRANSFER_RECIPIENT_KIND.NEW,
          name: "Luis García",
          account: { type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: "4111111111111111" },
          saveAsFavorite: false,
        },
      },
      "card-key",
    );

    expect(result.ok).toBe(true);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(1_245_080 - 5_000);
  });

  it("creates a favorite only when saveAsFavorite is true and the transfer succeeds", async () => {
    const newRecipient: TransferRecipientInput = {
      kind: TRANSFER_RECIPIENT_KIND.NEW,
      name: "Nuevo Favorito",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5511122233" },
      saveAsFavorite: true,
    };

    const result = await service.create(marianaId, { amountInCents: 5_000, recipient: newRecipient }, "fav-key");

    expect(result.ok).toBe(true);

    const contacts = await deps.db.read((repositories) => repositories.contacts.listByOwnerId(marianaId));
    expect(contacts.some((contact) => contact.name === "Nuevo Favorito")).toBe(true);
  });

  it("creates no contact when a saveAsFavorite transfer fails on balance", async () => {
    const newRecipient: TransferRecipientInput = {
      kind: TRANSFER_RECIPIENT_KIND.NEW,
      name: "Sin Fondos",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5544455566" },
      saveAsFavorite: true,
    };

    const result = await service.create(
      marianaId,
      { amountInCents: 1_245_080 + 1, recipient: newRecipient },
      "fav-fail-key",
    );

    expect(result.ok).toBe(false);

    const contacts = await deps.db.read((repositories) => repositories.contacts.listByOwnerId(marianaId));
    expect(contacts.some((contact) => contact.name === "Sin Fondos")).toBe(false);
  });

  it("reuses the existing contact for a duplicate account when saving as favorite twice", async () => {
    const newRecipient: TransferRecipientInput = {
      kind: TRANSFER_RECIPIENT_KIND.NEW,
      name: "Favorito Repetido",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5566677788" },
      saveAsFavorite: true,
    };

    await service.create(marianaId, { amountInCents: 1_000, recipient: newRecipient }, "dup-key-1");
    await service.create(marianaId, { amountInCents: 1_000, recipient: newRecipient }, "dup-key-2");

    const contacts = await deps.db.read((repositories) => repositories.contacts.listByOwnerId(marianaId));
    const matches = contacts.filter((contact) => contact.name === "Favorito Repetido");
    expect(matches).toHaveLength(1);
  });
});

describe("TransferService.getById", () => {
  it("returns the transfer when it belongs to the sender", async () => {
    const created = await service.create(marianaId, { amountInCents: 5_000, recipient: NEW_RECIPIENT }, "key-8");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await service.getById(marianaId, created.value.id);

    expect(result).toEqual({ ok: true, value: created.value });
  });

  it("returns NOT_FOUND for an unknown transfer", async () => {
    const result = await service.getById(marianaId, "trf_unknown" as TransferId);

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("TransferService.findByIdempotencyKey", () => {
  it("returns the transfer stored under that key", async () => {
    const created = await service.create(marianaId, { amountInCents: 5_000, recipient: NEW_RECIPIENT }, "key-9");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await service.findByIdempotencyKey(marianaId, "key-9");

    expect(result).toEqual({ ok: true, value: created.value });
  });

  it("returns NOT_FOUND for an unknown key", async () => {
    const result = await service.findByIdempotencyKey(marianaId, "unknown-key");

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });
});
