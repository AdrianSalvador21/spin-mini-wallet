import "server-only";
import { err, ok, type Result } from "@/domain/shared/result";
import type { UserId } from "@/domain/user/types";
import type { MovementDirection } from "@/domain/wallet/types";
import { READ_RESOURCE, type ReadResource } from "@/shared/lib/api/contract";
import type { MovementsPage, WalletSummary } from "@/shared/lib/api/views";
import type { Logger } from "@/shared/observability/logger";
import type { Services } from "../container";
import { runReadScenario } from "../mock/read-scenario";
import { readOutcome, resolveReadScenario } from "../mock/scenarios";

export const HOME_LOAD_FAILURE = { UNAVAILABLE: "unavailable" } as const;

export type HomeLoadFailure = { kind: typeof HOME_LOAD_FAILURE.UNAVAILABLE };

export interface HomeLoaderDependencies {
  services: Services;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  allowScenarioOverride: boolean;
  logger: Logger;
}

export interface HomeLoadRequest {
  userId: UserId;
  requestId: string;
  scenarioCookie?: string;
}

export interface HomeLoader {
  loadSummary(request: HomeLoadRequest): Promise<Result<WalletSummary, HomeLoadFailure>>;
  loadMovements(
    request: HomeLoadRequest & { direction?: MovementDirection },
  ): Promise<Result<MovementsPage, HomeLoadFailure>>;
}

export function createHomeLoader(deps: HomeLoaderDependencies): HomeLoader {
  async function load<T>(
    resource: ReadResource,
    requestId: string,
    scenarioCookie: string | undefined,
    run: () => Promise<Result<T, unknown>>,
  ): Promise<Result<T, HomeLoadFailure>> {
    const scenario = resolveReadScenario(scenarioCookie, deps.allowScenarioOverride);
    const outcome = readOutcome(scenario, resource);

    return runReadScenario(
      outcome,
      { sleep: deps.sleep, random: deps.random },
      async () => {
        const result = await run();

        if (!result.ok) {
          deps.logger.warn("home_load", { resource, scenario, requestId });
          return err({ kind: HOME_LOAD_FAILURE.UNAVAILABLE });
        }

        return ok(result.value);
      },
      async () => {
        deps.logger.warn("home_load", { resource, scenario, requestId });
        return err({ kind: HOME_LOAD_FAILURE.UNAVAILABLE });
      },
    );
  }

  return {
    loadSummary(request) {
      return load(READ_RESOURCE.SUMMARY, request.requestId, request.scenarioCookie, () =>
        deps.services.wallet.getSummary(request.userId),
      );
    },
    loadMovements(request) {
      return load(READ_RESOURCE.MOVEMENTS, request.requestId, request.scenarioCookie, () =>
        deps.services.wallet.listMovements(request.userId, { direction: request.direction }),
      );
    },
  };
}
