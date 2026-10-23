import "server-only";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import {
  READ_OUTCOME,
  READ_RESOURCE,
  READ_SCENARIO,
  TRANSFER_SCENARIO,
  type ReadOutcome,
  type ReadResource,
  type ReadScenario,
  type TransferScenario,
} from "@/shared/lib/api/contract";

export const READ_LATENCY_MS = [300, 800] as const;
export const TRANSFER_LATENCY_MS = [600, 1200] as const;
export const SLOW_READ_MS = 3000;
export const TIMEOUT_MS = 12000;

function isTransferScenario(value: string): value is TransferScenario {
  return (Object.values(TRANSFER_SCENARIO) as string[]).includes(value);
}

function isReadScenario(value: string): value is ReadScenario {
  return (Object.values(READ_SCENARIO) as string[]).includes(value);
}

export function pickScenario(random: () => number): TransferScenario {
  const value = random();

  if (value < 0.6) {
    return TRANSFER_SCENARIO.SUCCESS;
  }

  if (value < 0.7) {
    return TRANSFER_SCENARIO.NETWORK_ERROR;
  }

  if (value < 0.8) {
    return TRANSFER_SCENARIO.INSUFFICIENT_FUNDS;
  }

  if (value < 0.9) {
    return TRANSFER_SCENARIO.TIMEOUT;
  }

  return TRANSFER_SCENARIO.UNKNOWN_ERROR;
}

export function resolveTransferScenario(
  cookieValue: string | undefined,
  allowOverride: boolean,
  random: () => number,
): TransferScenario {
  if (allowOverride && cookieValue !== undefined && isTransferScenario(cookieValue)) {
    return cookieValue;
  }

  return pickScenario(random);
}

export function resolveReadScenario(cookieValue: string | undefined, allowOverride: boolean): ReadScenario {
  if (allowOverride && cookieValue !== undefined && isReadScenario(cookieValue)) {
    return cookieValue;
  }

  return READ_SCENARIO.OK;
}

export function readOutcome(scenario: ReadScenario, resource: ReadResource): ReadOutcome {
  switch (scenario) {
    case READ_SCENARIO.OK:
      return READ_OUTCOME.OK;
    case READ_SCENARIO.SLOW:
      return READ_OUTCOME.SLOW;
    case READ_SCENARIO.ERROR:
      return READ_OUTCOME.ERROR;
    case READ_SCENARIO.MOVEMENTS_ERROR:
      return resource === READ_RESOURCE.MOVEMENTS ? READ_OUTCOME.ERROR : READ_OUTCOME.OK;
    default:
      return assertUnreachable(scenario);
  }
}

export function latencyMs(range: readonly [number, number], random: () => number): number {
  const [min, max] = range;

  return min + Math.floor(random() * (max - min + 1));
}
