import "server-only";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { toFieldErrors } from "@/domain/shared/validation";
import { createTransferSchema } from "@/domain/transfer/schemas";
import { validateIdempotencyKey } from "@/domain/transfer/validators";
import {
  API_ERROR_CODE,
  IDEMPOTENCY_KEY_HEADER,
  SCENARIO_COOKIE,
  TRANSFER_SCENARIO,
} from "@/shared/lib/api/contract";
import { TIMEOUT_MS, TRANSFER_LATENCY_MS, latencyMs, resolveTransferScenario } from "../../mock/scenarios";
import { errorResponse, toApiError } from "../api-error";
import { json, readJsonBody } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";

export function createCreateTransferHandler(deps: HttpDependencies) {
  return createRouteHandler(deps, { mutating: true }, async (ctx) => {
    const keyResult = validateIdempotencyKey(ctx.request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? "");

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

    const idempotencyKey = keyResult.value;
    const bodyResult = await readJsonBody(ctx.request);

    if (!bodyResult.ok) {
      return errorResponse(
        { status: 400, code: API_ERROR_CODE.VALIDATION_ERROR, details: { body: ["BODY_INVALID_JSON"] } },
        ctx.requestId,
      );
    }

    const parsed = createTransferSchema.safeParse(bodyResult.value);

    if (!parsed.success) {
      return errorResponse(
        { status: 400, code: API_ERROR_CODE.VALIDATION_ERROR, details: toFieldErrors(parsed.error) },
        ctx.requestId,
      );
    }

    const replay = await deps.services.transfer.findByIdempotencyKey(ctx.session.userId, idempotencyKey);

    if (replay.ok) {
      const result = await deps.services.transfer.create(ctx.session.userId, parsed.data, idempotencyKey);

      return result.ok ? json(result.value, 201) : errorResponse(toApiError(result.error), ctx.requestId);
    }

    const check = await deps.services.transfer.check(ctx.session.userId, parsed.data);

    if (!check.ok) {
      return errorResponse(toApiError(check.error), ctx.requestId);
    }

    const cookieValue = ctx.request.cookies.get(SCENARIO_COOKIE.TRANSFER)?.value;
    const scenario = resolveTransferScenario(cookieValue, deps.allowScenarioOverride, deps.random);

    ctx.reportScenario(scenario);

    switch (scenario) {
      case TRANSFER_SCENARIO.SUCCESS: {
        await deps.sleep(latencyMs(TRANSFER_LATENCY_MS, deps.random));
        const result = await deps.services.transfer.create(ctx.session.userId, parsed.data, idempotencyKey);

        return result.ok ? json(result.value, 201) : errorResponse(toApiError(result.error), ctx.requestId);
      }
      case TRANSFER_SCENARIO.NETWORK_ERROR: {
        await deps.sleep(latencyMs(TRANSFER_LATENCY_MS, deps.random));

        return errorResponse({ status: 503, code: API_ERROR_CODE.UPSTREAM_UNAVAILABLE }, ctx.requestId);
      }
      case TRANSFER_SCENARIO.INSUFFICIENT_FUNDS: {
        await deps.sleep(latencyMs(TRANSFER_LATENCY_MS, deps.random));
        const summary = await deps.services.wallet.getSummary(ctx.session.userId);

        return errorResponse(
          {
            status: 422,
            code: API_ERROR_CODE.INSUFFICIENT_FUNDS,
            balance: summary.ok ? summary.value.balance : undefined,
          },
          ctx.requestId,
        );
      }
      case TRANSFER_SCENARIO.TIMEOUT: {
        await deps.sleep(TIMEOUT_MS);
        const result = await deps.services.transfer.create(ctx.session.userId, parsed.data, idempotencyKey);

        return result.ok ? json(result.value, 201) : errorResponse(toApiError(result.error), ctx.requestId);
      }
      case TRANSFER_SCENARIO.UNKNOWN_ERROR: {
        await deps.sleep(latencyMs(TRANSFER_LATENCY_MS, deps.random));

        return errorResponse({ status: 500, code: API_ERROR_CODE.INTERNAL_ERROR }, ctx.requestId);
      }
      default:
        return assertUnreachable(scenario);
    }
  });
}
