import "server-only";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { API_ERROR_CODE, READ_SCENARIO, SCENARIO_COOKIE } from "@/shared/lib/api/contract";
import { READ_LATENCY_MS, SLOW_READ_MS, latencyMs, resolveReadScenario } from "../../mock/scenarios";
import { errorResponse } from "../api-error";
import type { HttpDependencies, RouteContext } from "../route-handler";

export async function runWithReadScenario<P>(
  ctx: RouteContext<P>,
  deps: HttpDependencies,
  onSuccess: () => Promise<Response>,
): Promise<Response> {
  const cookieValue = ctx.request.cookies.get(SCENARIO_COOKIE.READ)?.value;
  const scenario = resolveReadScenario(cookieValue, deps.allowScenarioOverride);

  ctx.reportScenario(scenario);

  switch (scenario) {
    case READ_SCENARIO.OK:
      await deps.sleep(latencyMs(READ_LATENCY_MS, deps.random));
      return onSuccess();
    case READ_SCENARIO.SLOW:
      await deps.sleep(SLOW_READ_MS);
      return onSuccess();
    case READ_SCENARIO.ERROR:
      await deps.sleep(latencyMs(READ_LATENCY_MS, deps.random));
      return errorResponse({ status: 503, code: API_ERROR_CODE.UPSTREAM_UNAVAILABLE }, ctx.requestId);
    default:
      return assertUnreachable(scenario);
  }
}
