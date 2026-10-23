import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import type { TransferId, TransferRecipient } from "@/domain/transfer/types";
import type { UserId } from "@/domain/user/types";
import { createJsonDatabase } from "../db/json-database";
import { SCHEMA_VERSION, type DatabaseSnapshot } from "../db/schema";
import { createSeed } from "../db/seed";
import type { ServiceDependencies } from "./types";
import { createTransferService, type TransferService } from "./transfer-service";

const NOW = new Date("2026-10-21T12:00:00.000Z");

const CARLOS: TransferRecipient = { contactId: "ctc_carlos" as ContactId };
const ANA: TransferRecipient = { contactId: "ctc_ana" as ContactId };
const LUIS: TransferRecipient = { contactId: "ctc_luis" as ContactId };
const DIEGO: TransferRecipient = { contactId: "ctc_diego" as ContactId };

function cents(value: number): Cents {
  return value as Cents;
}

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
    const result = await service.create(marianaId, { amountInCents: cents(10_000), recipient: CARLOS }, "key-1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.status).toBe("completed");
    expect(result.value.folio).toMatch(/^SPN-\d{8}$/);
    expect(result.value.trackingKey).toMatch(/^SPIN\d{14}$/);
    expect(result.value.recipient.name).toBe("Carlos Ruiz");

    const summary = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(summary?.balance.amountInCents).toBe(1_245_080 - 10_000);

    const movements = await deps.db.read((repositories) => repositories.movements.listByUserId(marianaId));
    const transferOut = movements.find((movement) => movement.transferId === result.value.id);
    expect(transferOut?.counterpartyName).toBe("Carlos Ruiz");
    expect(transferOut?.counterpartyAccount?.type).toBe(RECIPIENT_ACCOUNT_TYPE.PHONE);
  });

  it("returns VALIDATION_ERROR when the amount is not positive", async () => {
    const result = await service.create(marianaId, { amountInCents: cents(0), recipient: CARLOS }, "key-2");

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { amountInCents: ["AMOUNT_NOT_POSITIVE"] } },
    });
  });

  it("returns INSUFFICIENT_FUNDS with the current balance", async () => {
    const result = await service.create(
      marianaId,
      { amountInCents: cents(1_245_080 + 1), recipient: CARLOS },
      "key-3",
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "INSUFFICIENT_FUNDS", balance: { amountInCents: 1_245_080, currency: "MXN" } },
    });
  });

  it("succeeds for an amount equal to the balance and leaves it at 0", async () => {
    const result = await service.create(marianaId, { amountInCents: cents(1_245_080), recipient: CARLOS }, "key-4");

    expect(result.ok).toBe(true);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(0);
  });

  it("replays the same transfer for a repeated idempotency key and payload", async () => {
    const first = await service.create(marianaId, { amountInCents: cents(10_000), recipient: CARLOS }, "key-5");
    const second = await service.create(marianaId, { amountInCents: cents(10_000), recipient: CARLOS }, "key-5");

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(second.value.id).toBe(first.value.id);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(1_245_080 - 10_000);
  });

  it("returns IDEMPOTENCY_CONFLICT for the same key with a different payload", async () => {
    await service.create(marianaId, { amountInCents: cents(10_000), recipient: CARLOS }, "key-6");
    const result = await service.create(marianaId, { amountInCents: cents(20_000), recipient: CARLOS }, "key-6");

    expect(result).toEqual({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("returns NOT_FOUND for a contact that does not exist", async () => {
    const result = await service.create(
      marianaId,
      { amountInCents: cents(10_000), recipient: { contactId: "ctc_does_not_exist" as ContactId } },
      "key-7",
    );

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("returns NOT_FOUND for a contact that belongs to another user", async () => {
    const result = await service.create(diegoId, { amountInCents: cents(1_000), recipient: CARLOS }, "key-foreign");

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("allows exactly 5 of 10 concurrent $2,000.00 transfers on a $10,000.00 balance", async () => {
    const concurrentTempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-transfers-concurrent-"));
    const concurrentDbPath = join(concurrentTempDir, "db.json");
    const userId = "usr_concurrent" as UserId;
    const contactId = "ctc_concurrent" as ContactId;

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
        { userId, balance: { amountInCents: cents(1_000_000), currency: "MXN" }, updatedAt: NOW.toISOString() },
      ],
      movements: [],
      contacts: [
        {
          id: contactId,
          ownerId: userId,
          name: "Carlos Ruiz",
          account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5523456789" },
          isFavorite: true,
          createdAt: NOW.toISOString(),
        },
      ],
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
        { amountInCents: cents(200_000), recipient: { contactId } },
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

describe("TransferService.create self-transfer and P2P credit", () => {
  it("returns RECIPIENT_IS_SELF for a contact holding the sender's own phone", async () => {
    const selfContactId = "ctc_self" as ContactId;

    await deps.db.transaction((repositories) => {
      repositories.contacts.insert({
        id: selfContactId,
        ownerId: marianaId,
        name: "Mariana López",
        account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" },
        isFavorite: false,
        createdAt: NOW.toISOString(),
      });
    });

    const result = await service.create(
      marianaId,
      { amountInCents: cents(10_000), recipient: { contactId: selfContactId } },
      "self-key",
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { recipient: ["RECIPIENT_IS_SELF"] } },
    });
  });

  it("credits Diego's wallet and creates his transfer_in when Mariana sends to his phone", async () => {
    const result = await service.create(marianaId, { amountInCents: cents(5_000), recipient: DIEGO }, "p2p-key");

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

  it("only debits the sender for a CLABE recipient", async () => {
    const result = await service.create(marianaId, { amountInCents: cents(5_000), recipient: ANA }, "clabe-key");

    expect(result.ok).toBe(true);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(1_245_080 - 5_000);
  });

  it("only debits the sender for a card recipient", async () => {
    const result = await service.create(marianaId, { amountInCents: cents(5_000), recipient: LUIS }, "card-key");

    expect(result.ok).toBe(true);

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(marianaId));
    expect(wallet?.balance.amountInCents).toBe(1_245_080 - 5_000);
  });
});

describe("TransferService.getById", () => {
  it("returns the transfer when it belongs to the sender", async () => {
    const created = await service.create(marianaId, { amountInCents: cents(5_000), recipient: CARLOS }, "key-8");
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
    const created = await service.create(marianaId, { amountInCents: cents(5_000), recipient: CARLOS }, "key-9");
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
