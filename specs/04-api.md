# SPEC 04 — HTTP API, scenario engine and observability

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 02, SPEC 03
> **Date:** 2026-10-21
> **Objective:** Expose the SPEC 03 services as `/api/v1/*` Route Handlers with one error envelope, CSRF checks, the weighted scenario engine and request-id–correlated logging and error reporting.

**Branch:** `feature/04-api` (branched from `develop`, merged back through a PR to `develop`).

## Why this spec exists

SPEC 03 built the server core with no HTTP, so the business rules were proven in isolation. This milestone is the HTTP layer the Client Components of SPEC 06–08 will call through TanStack Query (SPEC 00 §4). It also builds the scenario engine, because scenarios simulate HTTP behavior (latency, 503, timeouts) and only make sense next to the handlers.

Route Handlers stay thin. Each `route.ts` file binds a handler factory from `src/server/http/handlers/` to the container. The factories receive their dependencies (services, `random`, `sleep`, logger, reporter), so tests control latency and scenarios without global mocks, the same pattern as `ServiceDependencies` in SPEC 03.

## Scope

**In:**

- SPEC 00 §8 and §9 updated with the decisions below: the `FORBIDDEN` code, the `balance` field on the error body, the read-scenario semantics and the order of checks in `POST /transfers`.
- The HTTP contract in `src/shared/lib/api/contract.ts`: `ApiErrorCode`, `ApiErrorBody`, scenario constants, cookie and header names. Importable by the server and, from SPEC 06 on, by the client.
- An es-MX message for every `ApiErrorCode` under `errors.api.<CODE>`, and four new validation codes with their messages.
- Observability in `src/shared/observability/`: PII redaction, a structured JSON logger, the `ErrorReporter` interface and `ConsoleErrorReporter`.
- The HTTP core in `src/server/http/`: service-error mapping, CSRF and content-type checks, and the `createRouteHandler` wrapper (request id, session, error envelope, access log, error reporting).
- The scenario engine in `src/server/mock/scenarios.ts`: `pickScenario`, cookie overrides and latencies.
- Seven endpoints on five `route.ts` files under `src/app/api/v1/`.
- `src/proxy.ts` (request id only), `src/instrumentation.ts` (`onRequestError`) and `src/instrumentation-client.ts` (browser `error` and `unhandledrejection`).
- An "HTTP layer" section in `CLAUDE.md`.

**Out of scope (for future specs):**

- The route guard in `proxy.ts`, security headers and the login rate limit (SPEC 05).
- Playwright tests against the API. They need a real login, so they start in SPEC 05 (user decision).
- `apiClient`, the `ApiFailure` union, `AbortController` and the DEV scenario panel (SPEC 08).
- MSW handlers that mirror the API for hook tests (SPEC 06 onwards, next to the first hook).
- `error.tsx` and `global-error.tsx` (SPEC 06 onwards, with the UI).
- A real Sentry adapter (out of the project, SPEC 00 §2).

## Data model

### HTTP contract (`src/shared/lib/api/contract.ts`)

Pure types and `as const` objects, no runtime dependency on the server:

```ts
export const API_ERROR_CODE = {
  VALIDATION_ERROR: "VALIDATION_ERROR", UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN", NOT_FOUND: "NOT_FOUND",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS", IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE", INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: `errors.api.${ApiErrorCode}`;
    requestId: string;
    details?: Record<string, ValidationCode[]>;
    balance?: Money;
  };
}

export const TRANSFER_SCENARIO = {
  SUCCESS: "success", NETWORK_ERROR: "network_error",
  INSUFFICIENT_FUNDS: "insufficient_funds", TIMEOUT: "timeout", UNKNOWN_ERROR: "unknown_error",
} as const;
export const READ_SCENARIO = { OK: "ok", ERROR: "error", SLOW: "slow" } as const;

export const SCENARIO_COOKIE = { TRANSFER: "mock_scenario", READ: "mock_read_scenario" } as const;
export const REQUEST_ID_HEADER = "x-request-id";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
```

- `FORBIDDEN` is new (user decision). It answers `403` for a bad `Origin` and `415` for a wrong `Content-Type`.
- `balance` is new (user decision). It is present only on `INSUFFICIENT_FUNDS`, so the client reads the current balance as `Money` instead of parsing strings.
- `message` is an i18n key, never final text (SPEC 00 §8). `src/messages/es-MX/errors.test.ts` fails if a code has no `errors.api.<CODE>` message.

| `ApiErrorCode` | Status | es-MX message |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | "Revisa los datos e intenta de nuevo." |
| `UNAUTHORIZED` | 401 | "Tu sesión terminó. Inicia sesión de nuevo." |
| `FORBIDDEN` | 403 / 415 | "No pudimos verificar tu solicitud." |
| `NOT_FOUND` | 404 | "No encontramos lo que buscas." |
| `IDEMPOTENCY_CONFLICT` | 409 | "Este envío ya se procesó con otros datos." |
| `INSUFFICIENT_FUNDS` | 422 | "No tienes saldo suficiente para esta transferencia." |
| `INTERNAL_ERROR` | 500 | "Algo salió mal. Intenta más tarde." |
| `UPSTREAM_UNAVAILABLE` | 503 | "Se perdió la conexión. No se hizo ningún cargo." |

### New validation codes

Appended to `VALIDATION_CODES`, each with an es-MX message in `errors.validation` (user decision):

| Code | Field in `details` | When | Message |
| --- | --- | --- | --- |
| `IDEMPOTENCY_KEY_REQUIRED` | `idempotencyKey` | Header or query parameter missing or empty | "No pudimos identificar este envío. Vuelve a intentarlo." |
| `IDEMPOTENCY_KEY_INVALID` | `idempotencyKey` | Not a UUID v4 | "No pudimos identificar este envío. Vuelve a intentarlo." |
| `BODY_INVALID_JSON` | `body` | The request body is not valid JSON | "No pudimos leer la solicitud. Intenta de nuevo." |
| `LIMIT_INVALID` | `limit` | `limit` is present and is not a positive integer | "El número de movimientos solicitado no es válido." |

`validateIdempotencyKey(input): Result<string, ValidationCode>` lives in `src/domain/transfer/validators.ts`, under the 100 % domain gate. `BODY_INVALID_JSON` and `LIMIT_INVALID` are produced by `src/server/http/`.

### Status mapping (`src/server/http/api-error.ts`)

`toApiError(error: ServiceError): { status: number; code: ApiErrorCode; details?; balance? }` uses an exhaustive `switch` with `assertUnreachable`:

| `ServiceError.code` | Status | `ApiErrorCode` |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | `VALIDATION_ERROR` with `details` |
| `INSUFFICIENT_FUNDS` | 422 | `INSUFFICIENT_FUNDS` with `balance` |
| `NOT_FOUND` | 404 | `NOT_FOUND` |
| `IDEMPOTENCY_CONFLICT` | 409 | `IDEMPOTENCY_CONFLICT` |
| `INVALID_CREDENTIALS` | 401 | `UNAUTHORIZED` (no endpoint produces it; the case exists for exhaustiveness) |

`errorResponse(apiError, requestId): Response` builds the `ApiErrorBody`.

### Observability (`src/shared/observability/`)

- `redact.ts`: `redact(value: unknown): unknown` deep-copies objects and arrays and replaces the values of `password`, `passwordHash`, `phone`, `email`, `clabe` and `cardNumber` with `"[REDACTED]"`. It matches keys case-insensitively and handles cycles.
- `logger.ts`: `logger.info|warn|error(message, fields?)`. Each call writes one JSON line `{ level, message, timestamp, requestId?, context? }`, with `context` passed through `redact`. `info` and `warn` go to `console.log`, `error` to `console.error`. This is the only folder where `no-console` is off.
- `error-reporter.ts`: `interface ErrorReporter { captureException(error: unknown, context: ErrorContext): void }`, with `ErrorContext = { requestId?: string; source: "route-handler" | "request-error" | "browser"; [key: string]: unknown }`. `consoleErrorReporter` logs `error.name`, `error.message` and `error.stack` through `logger.error`. `getErrorReporter()` returns it. A Sentry adapter would be another implementation returned from the same function.

None of these files imports `server-only`: `instrumentation-client.ts` uses the logger and the reporter in the browser.

### Scenario engine (`src/server/mock/scenarios.ts`)

| Function | Behavior |
| --- | --- |
| `pickScenario(random)` | Weighted pick: `success` 60, the other four 10 each. `random() < 0.6` is `success`, then `network_error`, `insufficient_funds`, `timeout` and `unknown_error` in bands of 0.1 |
| `resolveTransferScenario(cookieValue, allowOverride, random)` | Returns the cookie value when `allowOverride` is true and the value is a `TRANSFER_SCENARIO` member. Otherwise `pickScenario(random)` |
| `resolveReadScenario(cookieValue, allowOverride)` | Returns the cookie value when allowed and valid. Otherwise `ok` |
| `latencyMs(range, random)` | An integer inside the range, inclusive. Ranges: `READ_LATENCY_MS = [300, 800]`, `TRANSFER_LATENCY_MS = [600, 1200]`, `SLOW_READ_MS = 3000`, `TIMEOUT_MS = 12000` |

A cookie with an unknown value is ignored, so a typo falls back to the random pick instead of failing.

### HTTP dependencies and wrapper (`src/server/http/`)

```ts
interface HttpDependencies {
  services: Services;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  createRequestId: () => string;
  logger: Logger;
  reporter: ErrorReporter;
  allowScenarioOverride: boolean;
}

interface RouteContext<P> { request: NextRequest; requestId: string; session: SessionPayload; params: P }

createRouteHandler<P>(deps, options: { mutating?: boolean }, handle: (ctx: RouteContext<P>) => Promise<Response>)
```

`createRouteHandler` returns the `(request, { params })` function a `route.ts` exports. In order, it:

1. Reads `x-request-id` from the request, or generates one with `createRequestId` when it is missing (tests and requests that skipped the proxy).
2. When `mutating`, runs `checkMutationRequest` (`csrf.ts`): `Content-Type` must start with `application/json` (else `415 FORBIDDEN`), and `Origin` must be present and its host must equal the `Host` header (else `403 FORBIDDEN`).
3. Calls `requireSession()`. `UnauthorizedError` becomes `401 UNAUTHORIZED`.
4. Runs `handle`. Any other thrown error becomes `500 INTERNAL_ERROR`, is logged with `logger.error` and is sent to `reporter.captureException` with `source: "route-handler"`.
5. Sets `x-request-id` and `Cache-Control: no-store` on every response, success or error.
6. Writes one `logger.info("api_request", …)` line with `method`, `path`, `status`, `durationMs` and `scenario` when one applied (user decision). It never logs the body.

`readJsonBody(request): Promise<Result<unknown, "BODY_INVALID_JSON">>` and `json(body, status)` are small helpers in the same folder.

`src/server/container.ts` gains `getHttpDependencies()`, built once from `getServices()`, `Math.random`, a `setTimeout`-based `sleep`, `crypto.randomUUID`, `logger`, `getErrorReporter()` and `getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE`.

### Endpoints (`src/app/api/v1/`)

Each `route.ts` is one line per method: `export const GET = createWalletSummaryHandler(getHttpDependencies())`. The factories live in `src/server/http/handlers/`.

| Route file | Method | Handler | Read scenario | Success |
| --- | --- | --- | --- | --- |
| `wallet/summary/route.ts` | GET | `WalletService.getSummary` | Yes | `200 { user, balance }` |
| `wallet/movements/route.ts` | GET | `WalletService.listMovements` with `cursor` and `limit` | Yes | `200 { items, nextCursor }` |
| `contacts/route.ts` | GET | `ContactService.listFavorites` | Yes | `200 { items }` |
| `contacts/route.ts` | POST | `ContactService.create` with `newContactSchema` | No | `201 ContactView` |
| `transfers/route.ts` | POST | `TransferService.create` | Transfer scenario | `201 TransferView` |
| `transfers/route.ts` | GET | `TransferService.findByIdempotencyKey` with `?idempotencyKey=` | No | `200 TransferView` or `404` |
| `transfers/[transferId]/route.ts` | GET | `TransferService.getById` | No | `200 TransferView` |

Read endpoints with the read scenario (user decision):

- `ok`: wait `latencyMs(READ_LATENCY_MS)`, then respond.
- `slow`: wait `SLOW_READ_MS` (3 s), then respond normally.
- `error`: wait `latencyMs(READ_LATENCY_MS)`, then `503 UPSTREAM_UNAVAILABLE`.

`limit` is optional. When present it must match `^\d+$` and be at least 1, else `400` with `limit: ["LIMIT_INVALID"]`. The service still clamps it to 1–50. A bad cursor keeps the service's `VALIDATION_ERROR`.

`POST /api/v1/transfers`, in this order (user decision):

1. CSRF and content type, then session (wrapper).
2. `validateIdempotencyKey` on the `Idempotency-Key` header → `400` on failure.
3. `readJsonBody`, then `createTransferSchema.safeParse` → `400` with `toFieldErrors` on failure.
4. **Replay:** `findByIdempotencyKey`. If the key already completed, respond `201` with that transfer and skip the scenario. A retry after a timeout never lands on a fake 503.
5. `resolveTransferScenario` with the `mock_scenario` cookie:
   - `success`: wait `latencyMs(TRANSFER_LATENCY_MS)`, then `TransferService.create`. Its own errors (real insufficient funds, conflict, foreign contact) map through `toApiError`.
   - `network_error`: wait `latencyMs(TRANSFER_LATENCY_MS)`, then `503 UPSTREAM_UNAVAILABLE`. No debit.
   - `insufficient_funds`: wait `latencyMs(TRANSFER_LATENCY_MS)`, then `422 INSUFFICIENT_FUNDS` with the real current balance from `WalletService.getSummary`. No debit.
   - `timeout`: wait `TIMEOUT_MS` (12 s), then `TransferService.create` as in `success`.
   - `unknown_error`: wait `latencyMs(TRANSFER_LATENCY_MS)`, then `500 INTERNAL_ERROR`. No debit, nothing sent to the reporter (it is a simulated failure, not a bug).

`GET /api/v1/transfers` without `idempotencyKey`, or with an invalid one, answers `400` with the matching code.

### Proxy and instrumentation

- `src/proxy.ts` (user decision: request id only): generates `crypto.randomUUID()`, overwrites any incoming `x-request-id` in the forwarded request headers and sets it on the response. Matcher: `/((?!_next/static|_next/image|favicon.ico|assets/).*)`. The route guard is added in SPEC 05.
- `src/instrumentation.ts`: `onRequestError(error, request, context)` reads `x-request-id` from `request.headers` and calls `getErrorReporter().captureException` with `source: "request-error"`, `path`, `method`, `routePath` and `routeType`.
- `src/instrumentation-client.ts` (user decision): registers `error` and `unhandledrejection` listeners on `window` that call the same reporter with `source: "browser"`.

## Implementation plan

Each step leaves typecheck, lint and tests green and is committed on its own. Before writing a step, read the relevant guide in `node_modules/next/dist/docs/` (`route.md`, `proxy.md`, `instrumentation.md`, `instrumentation-client.md`).

1. **Docs for the contract changes.** In SPEC 00 §8, add `FORBIDDEN` (403/415), the `balance` field, the status table and `Cache-Control: no-store`. In §9, add the read-scenario semantics (`error` = 503, `slow` = 3 s) and the order of checks in `POST /transfers`. In §17, move the API E2E to milestone 05. Mark 04 as in progress in `roadmap.md`.
   - Why: other sessions read these files, not this chat.

2. **HTTP contract and messages.** Create `src/shared/lib/api/contract.ts`. Add `errors.api.<CODE>` for the eight codes to `errors.json`, and extend `errors.test.ts` so it fails when an `API_ERROR_CODE` member has no message.
   - Why: the server and the future `apiClient` share one source for codes, scenario names and cookie names.

3. **New validation codes.** Append the four codes to `VALIDATION_CODES` with their messages. Add `validateIdempotencyKey` to `src/domain/transfer/validators.ts` with tests: empty, not a UUID, a UUID v1 and a valid v4.
   - Why: every 400 the API returns carries a code the UI can translate, as the domain convention requires.

4. **Observability.** Create `redact.ts`, `logger.ts` and `error-reporter.ts` with tests: nested and array redaction, case-insensitive keys, a cyclic object, one JSON line per call, `error` going to `console.error`, and the reporter logging name, message and stack. Add `src/shared/observability/**` to the 80 % coverage include in `vitest.config.mts`.
   - Why: the wrapper and the instrumentation files both depend on these, and PII redaction must be proven before anything logs.

5. **Error mapping and CSRF.** Create `src/server/http/api-error.ts` (`toApiError`, `errorResponse`), `csrf.ts` (`checkMutationRequest`) and `json.ts` (`json`, `readJsonBody`) with tests: every `ServiceError` code including the `assertUnreachable` default, missing and foreign `Origin`, `text/plain` content type, `application/json; charset=utf-8` accepted, and an invalid JSON body.
   - Why: pure pieces the wrapper composes. Testing them alone keeps the wrapper tests about flow, not formats.

6. **Route wrapper.** Create `src/server/http/route-handler.ts` (`createRouteHandler`, `HttpDependencies`, `RouteContext`) with tests that mock `next/headers`: a request id is reused or generated, `401` without a session, `403` and `415` on mutating routes before the session check, a thrown error becomes `500` and is reported, every response has `x-request-id` and `Cache-Control: no-store`, and the access log line has no body and no PII.
   - Why: every endpoint inherits these guarantees from one place.

7. **Scenario engine.** Create `src/server/mock/scenarios.ts` with tests: the band boundaries of `pickScenario` (0, 0.5999, 0.6, 0.7, 0.8, 0.9, 0.9999), the override honored only when allowed, an unknown cookie value ignored, and `latencyMs` staying inside its range at `random` 0 and 0.9999.
   - Why: weights and overrides are what make the demo random and the tests deterministic.

8. **Read endpoints.** Add `getHttpDependencies()` to `container.ts`. Create the handler factories and `route.ts` files for `wallet/summary`, `wallet/movements` and `GET contacts`, with tests against a temporary database and a fake `sleep`: the three read scenarios, `LIMIT_INVALID`, a bad cursor, and Diego's empty movements.
   - Why: the Home and recipient-step reads, with their loading and error states demonstrable on demand.

9. **Contact creation.** Add `POST` to `contacts/route.ts` with tests: `201` with a masked account, `400` with field codes for an invalid CLABE, a duplicate account returning the existing contact, and `BODY_INVALID_JSON`.
   - Why: the "save a new contact" requirement from PDF screen 3.

10. **Transfer endpoints.** Create the factories and `route.ts` files for `POST /transfers`, `GET /transfers` and `GET /transfers/[transferId]`, with tests: each of the five forced scenarios, the replay skipping the scenario, `IDEMPOTENCY_KEY_REQUIRED` and `IDEMPOTENCY_KEY_INVALID`, a real insufficient-funds `422` under `success`, `409` on conflict, the timeout path debiting only after the 12 s `sleep`, and `404` for an unknown id and an unknown key.
    - Why: this is the confirmation behavior of PDF screen 4, with the check order that keeps retries safe.

11. **Proxy and instrumentation.** Create `src/proxy.ts`, `src/instrumentation.ts` and `src/instrumentation-client.ts`, with tests: the proxy sets a UUID on the forwarded request and the response and overwrites a spoofed one, `onRequestError` reports with the request id, and the client listeners report `error` and `unhandledrejection`.
    - Why: correlation reaches every response, and unhandled errors on both sides reach the reporter.

12. **Docs.** Add an "HTTP layer" section to `CLAUDE.md`: thin `route.ts` files over handler factories, `createRouteHandler` and its order of checks, the contract in `src/shared/lib/api/`, the scenario cookies and the `errors.api.*` keys. Run `npm run dev` and check one endpoint by hand with `curl` (see the acceptance criteria).
    - Why: SPEC 05–08 build on these conventions from other sessions.

## Acceptance criteria

- [x] SPEC 00 §8 lists `FORBIDDEN`, the `balance` field and the status table, and §9 describes the read scenarios and the `POST /transfers` order.
- [x] `errors.test.ts` fails if any `API_ERROR_CODE` member or any of the four new validation codes has no es-MX message.
- [x] `validateIdempotencyKey` accepts a UUID v4 and returns `IDEMPOTENCY_KEY_INVALID` for a UUID v1.
- [x] `redact({ user: { Email: "a@b.mx", items: [{ cardNumber: "4111111111111111" }] } })` contains no email and no card number.
- [x] Every logger call writes exactly one parseable JSON line.
- [x] Every response from `/api/v1/*`, including `401`, `403`, `415` and `500`, has an `x-request-id` header equal to `error.requestId` in the body, and `Cache-Control: no-store`.
- [x] A request without `smw_session` to any of the seven endpoints answers `401 UNAUTHORIZED`.
- [x] A `POST` with `Origin: https://evil.test` answers `403 FORBIDDEN`, and one with `Content-Type: text/plain` answers `415 FORBIDDEN`, both without calling any service.
- [x] A handler that throws answers `500 INTERNAL_ERROR` and calls `reporter.captureException` once with the request id.
- [x] `pickScenario` returns `success` for `random` 0.5999 and `network_error` for 0.6, and `unknown_error` for 0.9999.
- [x] With `allowScenarioOverride: false`, a `mock_scenario=timeout` cookie has no effect.
- [x] `GET /wallet/summary` with `mock_read_scenario=error` answers `503 UPSTREAM_UNAVAILABLE`, and with `slow` calls `sleep(3000)` and answers `200`.
- [x] `GET /wallet/movements?limit=abc` answers `400` with `details.limit: ["LIMIT_INVALID"]`.
- [x] `POST /contacts` with a valid CLABE answers `201` and the body's `account.masked` contains at most 4 digits.
- [x] `POST /transfers` without `Idempotency-Key` answers `400` with `details.idempotencyKey: ["IDEMPOTENCY_KEY_REQUIRED"]`.
- [x] Forced `network_error` and `unknown_error` answer `503` and `500` and leave the sender's balance unchanged.
- [x] Forced `insufficient_funds` answers `422` with `error.balance` equal to the current balance and leaves it unchanged.
- [x] Forced `timeout` calls `sleep(12000)` before debiting, and `GET /transfers?idempotencyKey=` answers `404` before the debit and `200` after it.
- [x] Repeating a completed `POST /transfers` with the same key under forced `network_error` answers `201` with the same transfer id and debits once.
- [x] Under `success`, an amount above the balance answers `422 INSUFFICIENT_FUNDS` from the service.
- [x] `proxy` replaces an incoming `x-request-id: spoofed` with a UUID on both the forwarded request and the response.
- [x] `onRequestError` and the browser `error` listener each call the reporter once, with `source` `request-error` and `browser`.
- [x] With `npm run dev`, `curl -i http://localhost:3000/api/v1/wallet/summary` answers `401` with an `x-request-id` header, and the terminal shows one `api_request` JSON line with the same id.
- [x] `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100 % on `src/domain/**`, 80 % on `src/server/**`, `src/shared/lib/**` and `src/shared/observability/**`) and `npm run build` finish with no errors.
- [x] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** `proxy.ts` only sets the request id in this milestone (user decision). The pages it would guard do not exist until SPEC 05, and an untested guard is worse than none.
- **Yes:** a new `FORBIDDEN` code, `403` for a bad `Origin` and `415` for a wrong `Content-Type` (user decision). A CSRF attempt is not a form error.
- **No:** reusing `VALIDATION_ERROR` for CSRF. It would show a field-error UI for an attack.
- **Yes:** check order in `POST /transfers` is input → replay → scenario (user decision). Invalid input always gets a real `400`, and a completed key always replays, so retrying after a timeout cannot hit a simulated failure.
- **No:** picking the scenario before validating. A malformed payload could answer `503`, and a retry could fail after the money moved.
- **Yes:** `instrumentation-client.ts` in this milestone (user decision). All error reporting ships together; `error.tsx` and `global-error.tsx` stay with the UI.
- **Yes:** read scenario `error` is `503` and `slow` is 3 s (user decision). `503` makes the "Reintentar" button meaningful, and 3 s is long enough to see the skeleton.
- **Yes:** one access log line per request plus error logs, never the body (user decision). Scenarios and timings are traceable with no PII surface.
- **Yes:** the HTTP contract lives in `src/shared/lib/api/contract.ts` (user decision). Features cannot import `@/server`, and one file avoids client and server types drifting apart.
- **No:** putting the contract in `src/domain/`. HTTP is transport, not business.
- **Yes:** handler tests in the Vitest `node` project with injected `sleep` and `random` (user decision). They cover the 80 % gate and run in milliseconds even for the 12 s timeout.
- **Yes:** the API E2E smoke waits for SPEC 05 (user decision). It needs a real login, and signing cookies from a test fixture would duplicate the token format.
- **No:** a test-only session endpoint. It is a back door in app code.
- **Yes:** a typed `balance?: Money` on the error body (user decision). The client never parses cents out of strings.
- **Yes:** four new validation codes for HTTP input failures (user decision). Every `400` carries a translatable reason, as the domain convention requires.
- **Yes:** the mock latencies apply everywhere, including E2E and `next dev` (user decision). The evaluator and the tests see the same behavior, and no extra environment variable is needed.
- **Yes:** thin `route.ts` files over handler factories in `src/server/http/handlers/`. `src/app/` keeps no logic, and tests inject dependencies instead of mocking modules.
- **Yes:** the forced `insufficient_funds` scenario returns the real current balance. The UI shows a true number even when the failure is simulated.
- **Yes:** simulated `unknown_error` is not sent to the reporter. The reporter is for bugs, and a demo scenario would flood it.
- **Yes:** `Cache-Control: no-store` on every API response. Balances and receipts must never be served from a shared cache.
- **Yes:** the proxy overwrites any incoming `x-request-id`. A client cannot inject a value into server logs.
- **Yes:** `INVALID_CREDENTIALS` maps to `401 UNAUTHORIZED`. No endpoint produces it, but the exhaustive `switch` needs a case.
- **Yes:** an unknown scenario cookie value is ignored. A typo falls back to the random pick instead of breaking the endpoint.

## Risks

| Risk | Mitigation |
| --- | --- |
| Cache Components tries to prerender a `GET` Route Handler at build time | The wrapper awaits `requireSession()` (which reads `cookies()`) before any work, so every handler is dynamic. `npm run build` is part of the acceptance criteria and catches it |
| The 12 s `timeout` scenario exceeds the serverless duration limit on Vercel | Already in SPEC 00 §19. Demonstrated locally and in E2E from SPEC 08; documented in the README in SPEC 09 |
| Tests that wait for real latencies become slow | Handler factories receive `sleep`; tests pass a fake that records the requested milliseconds and resolves at once |
| `onRequestError` and the wrapper both report the same error | The wrapper catches handler errors and returns `500`, so they never reach `onRequestError`. That hook only sees errors outside Route Handlers |
| Redaction misses a PII key nested under an unexpected name | Redaction matches keys case-insensitively at every depth, and the access log never includes bodies |

## What is **not** in this spec

- The route guard, security headers and the login rate limit (SPEC 05).
- Playwright tests against the API (SPEC 05).
- `apiClient`, `ApiFailure`, `AbortController` and the DEV scenario panel (SPEC 08).
- MSW handlers for the API (SPEC 06 onwards).
- `error.tsx` and `global-error.tsx` (SPEC 06 onwards).
- A real Sentry adapter.

Each of them lands in the milestone listed in `specs/roadmap.md`.
