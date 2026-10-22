import "server-only";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { UserId } from "@/domain/user/types";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE, type MovementId } from "@/domain/wallet/types";
import { createJsonDatabase } from "./json-database";
import type { DatabaseSnapshot } from "./schema";

let tempDir: string;
let dbPath: string;

function buildStubSeed(): DatabaseSnapshot {
  return {
    schemaVersion: 1,
    users: [],
    wallets: [],
    movements: [],
    contacts: [],
    transfers: [],
    idempotencyKeys: [],
  };
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-db-"));
  dbPath = join(tempDir, "db.json");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("createJsonDatabase", () => {
  it("creates the file from the seed when it does not exist", async () => {
    const db = createJsonDatabase(dbPath, buildStubSeed);

    const user = await db.read((repositories) => repositories.users.findById("usr_1" as UserId));

    expect(user).toBeUndefined();

    const raw = await readFile(dbPath, "utf8");
    const persisted = JSON.parse(raw) as DatabaseSnapshot;
    expect(persisted.schemaVersion).toBe(1);
  });

  it("regenerates the file when the schema version does not match", async () => {
    await writeFile(dbPath, JSON.stringify({ schemaVersion: 0, users: [{ id: "stale" }] }), "utf8");
    const db = createJsonDatabase(dbPath, buildStubSeed);

    const user = await db.read((repositories) => repositories.users.findById("usr_1" as UserId));

    expect(user).toBeUndefined();

    const raw = await readFile(dbPath, "utf8");
    const persisted = JSON.parse(raw) as DatabaseSnapshot;
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.users).toEqual([]);
  });

  it("writes nothing when the transaction throws", async () => {
    const db = createJsonDatabase(dbPath, buildStubSeed);
    await db.read(() => undefined);
    const before = await readFile(dbPath, "utf8");

    await expect(
      db.transaction(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const after = await readFile(dbPath, "utf8");
    expect(after).toBe(before);
  });

  it("keeps every write under 20 concurrent transactions", async () => {
    const db = createJsonDatabase(dbPath, buildStubSeed);
    await db.read(() => undefined);

    const writes = Array.from({ length: 20 }, (_, index) =>
      db.transaction((repositories) => {
        repositories.movements.insert({
          id: `mov_${index}` as MovementId,
          userId: "usr_1" as UserId,
          type: MOVEMENT_TYPE.CASH_DEPOSIT,
          direction: MOVEMENT_DIRECTION.CREDIT,
          amount: toMoney(100 as Cents),
          merchantName: "Test",
          createdAt: new Date().toISOString(),
        });
      }),
    );

    await Promise.all(writes);

    const total = await db.read((repositories) => repositories.movements.listByUserId("usr_1" as UserId).length);

    expect(total).toBe(20);
  });
});
