import "server-only";
import type { TransferId } from "@/domain/transfer/types";
import { errorResponse, toApiError } from "../api-error";
import { json } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";

export interface GetTransferParams {
  transferId: string;
}

export function createGetTransferHandler(deps: HttpDependencies) {
  return createRouteHandler<GetTransferParams>(deps, {}, async (ctx) => {
    const result = await deps.services.transfer.getById(
      ctx.session.userId,
      ctx.params.transferId as TransferId,
    );

    if (!result.ok) {
      return errorResponse(toApiError(result.error), ctx.requestId);
    }

    return json(result.value, 200);
  });
}
