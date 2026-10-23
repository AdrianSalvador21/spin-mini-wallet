import type { BrowserContext } from "@playwright/test";
import { SCENARIO_COOKIE, type ReadScenario, type TransferScenario } from "../../src/shared/lib/api/contract";

export async function setReadScenario(context: BrowserContext, value: ReadScenario): Promise<void> {
  await context.addCookies([{ name: SCENARIO_COOKIE.READ, value, domain: "localhost", path: "/" }]);
}

export async function clearReadScenario(context: BrowserContext): Promise<void> {
  await context.clearCookies({ name: SCENARIO_COOKIE.READ });
}

export async function setTransferScenario(context: BrowserContext, value: TransferScenario): Promise<void> {
  await context.addCookies([{ name: SCENARIO_COOKIE.TRANSFER, value, domain: "localhost", path: "/" }]);
}

export async function clearTransferScenario(context: BrowserContext): Promise<void> {
  await context.clearCookies({ name: SCENARIO_COOKIE.TRANSFER });
}
