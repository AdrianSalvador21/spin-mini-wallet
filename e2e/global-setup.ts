import { rm } from "node:fs/promises";
import { resolve } from "node:path";

export const E2E_DB_PATH = ".data/e2e-db.json";

export default async function globalSetup(): Promise<void> {
  await rm(resolve(E2E_DB_PATH), { force: true });
}
