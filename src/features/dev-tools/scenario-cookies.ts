import {
  READ_SCENARIO,
  SCENARIO_COOKIE,
  TRANSFER_SCENARIO,
  type ReadScenario,
  type TransferScenario,
} from "@/shared/lib/api/contract";

export type ScenarioCookieName = (typeof SCENARIO_COOKIE)[keyof typeof SCENARIO_COOKIE];

export interface ScenarioCookies {
  transfer: TransferScenario | null;
  read: ReadScenario | null;
}

const TRANSFER_SCENARIOS: readonly string[] = Object.values(TRANSFER_SCENARIO);
const READ_SCENARIOS: readonly string[] = Object.values(READ_SCENARIO);

function cookieValue(cookie: string, name: string): string | null {
  const prefix = `${name}=`;
  const entry = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry === undefined ? null : decodeURIComponent(entry.slice(prefix.length));
}

function isTransferScenario(value: string | null): value is TransferScenario {
  return value !== null && TRANSFER_SCENARIOS.includes(value);
}

function isReadScenario(value: string | null): value is ReadScenario {
  return value !== null && READ_SCENARIOS.includes(value);
}

export function readScenarioCookies(cookie: string = document.cookie): ScenarioCookies {
  const transfer = cookieValue(cookie, SCENARIO_COOKIE.TRANSFER);
  const read = cookieValue(cookie, SCENARIO_COOKIE.READ);

  return {
    transfer: isTransferScenario(transfer) ? transfer : null,
    read: isReadScenario(read) ? read : null,
  };
}

export function writeScenarioCookie(name: ScenarioCookieName, value: string | null): void {
  document.cookie =
    value === null
      ? `${name}=; Path=/; SameSite=Lax; Max-Age=0`
      : `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}
