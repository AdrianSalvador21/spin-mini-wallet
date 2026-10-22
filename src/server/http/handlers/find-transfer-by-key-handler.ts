import "server-only";
import { validateIdempotencyKey } from "@/domain/transfer/validators";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { errorResponse, toApiError } from "../api-error";
import { json } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";

export function createFindTransferByKeyHandler(deps: HttpDependencies) {
  return createRouteHandler(deps, {}, async (ctx) => {
    const keyResult = validateIdempotencyKey(ctx.request.nextUrl.searchParams.get("idempotencyKey") ?? "");

    if (!keyResult.ok) {
      return errorResponse(
        {
          status: 400,
          code: API_ERROR_CODE.VALIDATION_ERROR,
          details: { idempotencyKey: [keyResult.error] },
        },
        ctx.requestId,
      );
    }

    const result = await deps.services.transfer.findByIdempotencyKey(ctx.session.userId, keyResult.value);

    if (!result.ok) {
      return errorResponse(toApiError(result.error), ctx.requestId);
    }

    return json(result.value, 200);
  });
}
