import "server-only";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { READ_OUTCOME, type ReadOutcome } from "@/shared/lib/api/contract";
import { READ_LATENCY_MS, SLOW_READ_MS, latencyMs } from "./scenarios";

export interface ReadScenarioDependencies {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

export async function runReadScenario<T>(
  outcome: ReadOutcome,
  deps: ReadScenarioDependencies,
  onOk: () => Promise<T>,
  onError: () => Promise<T>,
): Promise<T> {
  switch (outcome) {
    case READ_OUTCOME.OK:
      await deps.sleep(latencyMs(READ_LATENCY_MS, deps.random));
      return onOk();
    case READ_OUTCOME.SLOW:
      await deps.sleep(SLOW_READ_MS);
      return onOk();
    case READ_OUTCOME.ERROR:
      await deps.sleep(latencyMs(READ_LATENCY_MS, deps.random));
      return onError();
    default:
      return assertUnreachable(outcome);
  }
}
