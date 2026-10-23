import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRepositories, type Repositories } from "../repositories";
import { SCHEMA_VERSION, type DatabaseSnapshot } from "./schema";

export interface Database {
  read<T>(work: (repositories: Repositories) => T): Promise<T>;
  transaction<T>(work: (repositories: Repositories) => T): Promise<T>;
}

const LOCK_KEY = Symbol.for("spin-mini-wallet.db-lock");

type GlobalWithLock = typeof globalThis & { [LOCK_KEY]?: Promise<void> };

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const globalWithLock = globalThis as GlobalWithLock;
  const previous = globalWithLock[LOCK_KEY] ?? Promise.resolve();
  const result = previous.then(task, task);

  globalWithLock[LOCK_KEY] = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

async function writeSnapshot(filePath: string, snapshot: DatabaseSnapshot): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  await writeFile(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readOrSeed(
  filePath: string,
  createSeed: () => DatabaseSnapshot | Promise<DatabaseSnapshot>,
): Promise<DatabaseSnapshot> {
  let raw: string;

  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const seed = await createSeed();
      await writeSnapshot(filePath, seed);

      return seed;
    }

    throw error;
  }

  const snapshot = JSON.parse(raw) as DatabaseSnapshot;

  if (snapshot.schemaVersion !== SCHEMA_VERSION) {
    const seed = await createSeed();
    await writeSnapshot(filePath, seed);

    return seed;
  }

  return snapshot;
}

export function createJsonDatabase(
  filePath: string,
  createSeed: () => DatabaseSnapshot | Promise<DatabaseSnapshot>,
): Database {
  return {
    read<T>(work: (repositories: Repositories) => T): Promise<T> {
      return withLock(async () => work(createRepositories(await readOrSeed(filePath, createSeed))));
    },
    transaction<T>(work: (repositories: Repositories) => T): Promise<T> {
      return withLock(async () => {
        const snapshot = await readOrSeed(filePath, createSeed);
        const result = work(createRepositories(snapshot));

        await writeSnapshot(filePath, snapshot);

        return result;
      });
    },
  };
}
