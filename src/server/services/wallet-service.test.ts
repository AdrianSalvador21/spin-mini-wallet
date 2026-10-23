import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UserId } from "@/domain/user/types";
import { createJsonDatabase } from "../db/json-database";
import { createSeed } from "../db/seed";
import type { ServiceDependencies } from "./types";
import { createWalletService, type WalletService } from "./wallet-service";

const NOW = new Date("2026-10-21T12:00:00.000Z");
let tempDir: string;
let service: WalletService;
let marianaId: UserId;
let diegoId: UserId;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-wallet-"));
  const dbPath = join(tempDir, "db.json");
  const db = createJsonDatabase(dbPath, () => createSeed(NOW));
  const deps: ServiceDependencies = { db, now: () => NOW, random: () => 0.5, createId: () => "id" };
  service = createWalletService(deps);

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

describe("getSummary", () => {
  it("returns Mariana's balance, name, masked phone and email", async () => {
    const result = await service.getSummary(marianaId);

    expect(result).toEqual({
      ok: true,
      value: {
        user: {
          id: marianaId,
          fullName: "Mariana López",
          maskedPhone: "55 •••• 5678",
          email: "mariana@spin.test",
        },
        balance: { amountInCents: 1245080, currency: "MXN" },
      },
    });
  });

  it("returns NOT_FOUND for an unknown user", async () => {
    const result = await service.getSummary("usr_unknown" as UserId);

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("listMovements", () => {
  it("paginates Mariana's movements across three pages with no duplicates or gaps", async () => {
    const seen = new Set<string>();
    const pageSizes: number[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 3; page++) {
      const result = await service.listMovements(marianaId, { cursor, limit: 10 });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        break;
      }

      pageSizes.push(result.value.items.length);

      for (const item of result.value.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }

      if (!result.value.nextCursor) {
        break;
      }

      cursor = result.value.nextCursor;
    }

    expect(pageSizes).toEqual([10, 10, 5]);
    expect(seen.size).toBe(25);
  });

  it("returns VALIDATION_ERROR for an invalid cursor", async () => {
    const result = await service.listMovements(marianaId, { cursor: "not-a-cursor" });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { cursor: ["INVALID_CURSOR"] } },
    });
  });

  it("returns Diego's empty list", async () => {
    const result = await service.listMovements(diegoId);

    expect(result).toEqual({ ok: true, value: { items: [], nextCursor: null } });
  });

  it("returns only credit movements when filtering by direction", async () => {
    const seen = new Set<string>();
    let cursor: string | undefined;
    let total = 0;

    for (let page = 0; page < 5; page++) {
      const result = await service.listMovements(marianaId, { cursor, direction: "credit", limit: 10 });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        break;
      }

      for (const item of result.value.items) {
        expect(item.direction).toBe("credit");
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }

      total += result.value.items.length;

      if (!result.value.nextCursor) {
        break;
      }

      cursor = result.value.nextCursor;
    }

    expect(total).toBe(12);
  });

  it("keeps paginating with no duplicates when a cursor from the unfiltered list is reused with a direction filter", async () => {
    const firstPage = await service.listMovements(marianaId, { limit: 10 });
    expect(firstPage.ok).toBe(true);
    if (!firstPage.ok || !firstPage.value.nextCursor) {
      return;
    }

    const seenInFirstPage = new Set(firstPage.value.items.map((item) => item.id));

    const filteredPage = await service.listMovements(marianaId, {
      cursor: firstPage.value.nextCursor,
      direction: "credit",
    });

    expect(filteredPage.ok).toBe(true);
    if (!filteredPage.ok) {
      return;
    }

    for (const item of filteredPage.value.items) {
      expect(item.direction).toBe("credit");
      expect(seenInFirstPage.has(item.id)).toBe(false);
    }
  });
});
