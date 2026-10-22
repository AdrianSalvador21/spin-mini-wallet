import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import type { UserId } from "@/domain/user/types";
import { createJsonDatabase } from "../db/json-database";
import { createSeed } from "../db/seed";
import { createContactService, type ContactService } from "./contact-service";
import type { ServiceDependencies } from "./types";

const NOW = new Date("2026-10-21T12:00:00.000Z");
let tempDir: string;
let service: ContactService;
let marianaId: UserId;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-contacts-"));
  const dbPath = join(tempDir, "db.json");
  const db = createJsonDatabase(dbPath, () => createSeed(NOW));
  const deps: ServiceDependencies = { db, now: () => NOW, random: () => 0.5, createId: () => "newid" };
  service = createContactService(deps);

  const snapshot = await createSeed(NOW);
  const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");

  if (!mariana) {
    throw new Error("Seed is missing Mariana");
  }

  marianaId = mariana.id;
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("listFavorites", () => {
  it("returns Mariana's 4 favorites sorted by name with masked accounts", async () => {
    const favorites = await service.listFavorites(marianaId);

    expect(favorites).toHaveLength(4);
    expect(favorites.map((contact) => contact.name)).toEqual(
      [...favorites.map((contact) => contact.name)].sort((a, b) => a.localeCompare(b)),
    );
    expect(favorites.every((contact) => (contact.account.masked.match(/\d/g) ?? []).length <= 4)).toBe(true);

    const ana = favorites.find((contact) => contact.name === "Ana Torres");
    expect(ana?.account.bankName).toBe("Banamex");
  });
});

describe("create", () => {
  it("creates a new favorite", async () => {
    const result = await service.create(marianaId, {
      name: "Nuevo Contacto",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5599999999" },
      saveAsFavorite: true,
    });

    expect(result.name).toBe("Nuevo Contacto");
    expect(result.isFavorite).toBe(true);

    const favorites = await service.listFavorites(marianaId);
    expect(favorites).toHaveLength(5);
  });

  it("reuses the existing contact for a duplicate account", async () => {
    const before = await service.listFavorites(marianaId);
    const carlosBefore = before.find((contact) => contact.name === "Carlos Ruiz");

    const result = await service.create(marianaId, {
      name: "Carlos Ruiz",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5523456789" },
      saveAsFavorite: true,
    });

    const after = await service.listFavorites(marianaId);

    expect(after).toHaveLength(before.length);
    expect(result.id).toBe(carlosBefore?.id);
  });
});
