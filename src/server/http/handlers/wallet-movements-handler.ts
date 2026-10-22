import "server-only";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { errorResponse, toApiError } from "../api-error";
import { json } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";
import { runWithReadScenario } from "./read-scenario";

const LIMIT_PATTERN = /^\d+$/;

export function createWalletMovementsHandler(deps: HttpDependencies) {
  return createRouteHandler(deps, {}, (ctx) =>
    runWithReadScenario(ctx, deps, async () => {
      const searchParams = ctx.request.nextUrl.searchParams;
      const limitParam = searchParams.get("limit");

      if (limitParam !== null && (!LIMIT_PATTERN.test(limitParam) || Number(limitParam) < 1)) {
        return errorResponse(
          {
            status: 400,
            code: API_ERROR_CODE.VALIDATION_ERROR,
            details: { limit: ["LIMIT_INVALID"] },
          },
          ctx.requestId,
        );
      }

      const result = await deps.services.wallet.listMovements(ctx.session.userId, {
        cursor: searchParams.get("cursor") ?? undefined,
        limit: limitParam !== null ? Number(limitParam) : undefined,
      });

      if (!result.ok) {
        return errorResponse(toApiError(result.error), ctx.requestId);
      }

      return json(result.value, 200);
    }),
  );
}
