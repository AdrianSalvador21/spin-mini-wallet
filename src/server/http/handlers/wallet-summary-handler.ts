import "server-only";
import { READ_RESOURCE } from "@/shared/lib/api/contract";
import { errorResponse, toApiError } from "../api-error";
import { json } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";
import { runWithReadScenario } from "./read-scenario";

export function createWalletSummaryHandler(deps: HttpDependencies) {
  return createRouteHandler(deps, {}, (ctx) =>
    runWithReadScenario(ctx, deps, READ_RESOURCE.SUMMARY, async () => {
      const result = await deps.services.wallet.getSummary(ctx.session.userId);

      if (!result.ok) {
        return errorResponse(toApiError(result.error), ctx.requestId);
      }

      return json(result.value, 200);
    }),
  );
}
