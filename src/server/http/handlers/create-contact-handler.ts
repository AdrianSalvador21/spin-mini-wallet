import "server-only";
import { newContactSchema } from "@/domain/contact/schemas";
import { toFieldErrors } from "@/domain/shared/validation";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { errorResponse, toApiError } from "../api-error";
import { readJsonBody, json } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";

export function createCreateContactHandler(deps: HttpDependencies) {
  return createRouteHandler(deps, { mutating: true }, async (ctx) => {
    const bodyResult = await readJsonBody(ctx.request);

    if (!bodyResult.ok) {
      return errorResponse(
        { status: 400, code: API_ERROR_CODE.VALIDATION_ERROR, details: { body: ["BODY_INVALID_JSON"] } },
        ctx.requestId,
      );
    }

    const parsed = newContactSchema.safeParse(bodyResult.value);

    if (!parsed.success) {
      return errorResponse(
        { status: 400, code: API_ERROR_CODE.VALIDATION_ERROR, details: toFieldErrors(parsed.error) },
        ctx.requestId,
      );
    }

    const result = await deps.services.contact.create(ctx.session.userId, parsed.data);

    if (!result.ok) {
      return errorResponse(toApiError(result.error), ctx.requestId);
    }

    return json(result.value.contact, result.value.created ? 201 : 200);
  });
}
