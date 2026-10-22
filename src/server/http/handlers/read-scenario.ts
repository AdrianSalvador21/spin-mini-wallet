import "server-only";
import { API_ERROR_CODE, SCENARIO_COOKIE, type ReadResource } from "@/shared/lib/api/contract";
import { runReadScenario } from "../../mock/read-scenario";
import { readOutcome, resolveReadScenario } from "../../mock/scenarios";
import { errorResponse } from "../api-error";
import type { HttpDependencies, RouteContext } from "../route-handler";

export async function runWithReadScenario<P>(
  ctx: RouteContext<P>,
  deps: HttpDependencies,
  resource: ReadResource,
  onSuccess: () => Promise<Response>,
): Promise<Response> {
  const cookieValue = ctx.request.cookies.get(SCENARIO_COOKIE.READ)?.value;
  const scenario = resolveReadScenario(cookieValue, deps.allowScenarioOverride);

  ctx.reportScenario(scenario);

  return runReadScenario(
    readOutcome(scenario, resource),
    { sleep: deps.sleep, random: deps.random },
    onSuccess,
    () => Promise.resolve(errorResponse({ status: 503, code: API_ERROR_CODE.UPSTREAM_UNAVAILABLE }, ctx.requestId)),
  );
}
