import "server-only";
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { UserId } from "@/domain/user/types";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE, type MovementId } from "@/domain/wallet/types";
import { createJsonDatabase } from "./json-database";
import { createSeed } from "./seed";
import { SCHEMA_VERSION, type DatabaseSnapshot } from "./schema";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();

  return { ...actual, rename: vi.fn(actual.rename) };
});

let tempDir: string;
let dbPath: string;

function buildStubSeed(): DatabaseSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
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
    expect(persisted.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("regenerates the file when the schema version does not match", async () => {
    await writeFile(dbPath, JSON.stringify({ schemaVersion: 0, users: [{ id: "stale" }] }), "utf8");
    const db = createJsonDatabase(dbPath, buildStubSeed);

    const user = await db.read((repositories) => repositories.users.findById("usr_1" as UserId));

    expect(user).toBeUndefined();

    const raw = await readFile(dbPath, "utf8");
    const persisted = JSON.parse(raw) as DatabaseSnapshot;
    expect(persisted.schemaVersion).toBe(SCHEMA_VERSION);
    expect(persisted.users).toEqual([]);
  });

  it("removes the temp file and rethrows when the rename fails", async () => {
    const db = createJsonDatabase(dbPath, buildStubSeed);
    await db.read(() => undefined);
    vi.mocked(rename).mockRejectedValueOnce(new Error("EPERM"));

    await expect(db.transaction(() => undefined)).rejects.toThrow("EPERM");

    expect((await readdir(tempDir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
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

  it("regenerates a stale v1 file from the real seed", async () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    const staleSnapshot: DatabaseSnapshot = {
      ...buildStubSeed(),
      schemaVersion: 1 as unknown as typeof SCHEMA_VERSION,
      users: [{ id: "stale" } as DatabaseSnapshot["users"][number]],
    };
    await writeFile(dbPath, JSON.stringify(staleSnapshot), "utf8");
    const db = createJsonDatabase(dbPath, () => createSeed(now));

    const mariana = await db.read((repositories) => repositories.users.findByPhone("5512345678"));
    expect(mariana?.fullName).toBe("Mariana López");

    const raw = await readFile(dbPath, "utf8");
    const persisted = JSON.parse(raw) as DatabaseSnapshot;
    expect(persisted.schemaVersion).toBe(SCHEMA_VERSION);
    expect(persisted.users.some((user) => user.fullName === "Mariana López")).toBe(true);
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

  it("serializes reads with transactions, so a read never overlaps the file being replaced", async () => {
    const db = createJsonDatabase(dbPath, buildStubSeed);
    await db.read(() => undefined);
    const order: string[] = [];

    const operations = Array.from({ length: 10 }, (_, index) =>
      index % 2 === 0
        ? db.transaction((repositories) => {
            order.push(`write-${index}`);
            repositories.movements.insert({
              id: `mov_${index}` as MovementId,
              userId: "usr_1" as UserId,
              type: MOVEMENT_TYPE.CASH_DEPOSIT,
              direction: MOVEMENT_DIRECTION.CREDIT,
              amount: toMoney(100 as Cents),
              merchantName: "Test",
              createdAt: new Date().toISOString(),
            });
          })
        : db.read((repositories) => {
            order.push(`read-${index}`);
            return repositories.movements.listByUserId("usr_1" as UserId).length;
          }),
    );

    const results = await Promise.all(operations);

    expect(order).toEqual(Array.from({ length: 10 }, (_, index) => `${index % 2 === 0 ? "write" : "read"}-${index}`));
    expect(results.filter((value) => typeof value === "number")).toEqual([1, 2, 3, 4, 5]);
  });
});
