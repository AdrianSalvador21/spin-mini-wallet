# SPEC 08 — Confirmation and receipt

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 02, SPEC 03, SPEC 04, SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-22
> **Objective:** Confirm the transfer from the review step with an idempotent, 8-second-bounded request, show each of the five outcomes plus the timeout status lookup, and land a success on a reloadable receipt at `/transfers/[transferId]`.

**Branch:** `feature/08-confirmation-receipt`, already created from `origin/develop` (`3965ae3`, the merge of PR #7) and merged back through a PR to `develop`.

## Why this spec exists

SPEC 07 left "Confirmar envío" rendered and disabled behind an `onConfirm` slot. This milestone fills that slot. It covers PDF screen 4 (the five random outcomes and the receipt) and the end of screen 3.

Four findings from the code shaped the decisions below:

- In the `timeout` scenario, the server sleeps 12 s and then debits (`TIMEOUT_MS` in `src/server/mock/scenarios.ts`). A status lookup made right after the client aborts at 8 s answers `404`, although the transfer is about to complete.
- The simulated `insufficient_funds` scenario returns the real balance, which is usually larger than the amount. The design's copy ("Hoy tienes $200.00 disponibles y el envío es de $350.00") would read as a contradiction in the demo.
- `proxy.ts` always generates a new `x-request-id`, `/api/**` included. When the client aborts, or `fetch` throws, no response arrives, so a timeout or offline screen would have no "Referencia".
- `/transfers/[transferId]` is private. Sharing its URL gives the recipient a login page.

## Scope

**In:**

- SPEC 00 §4, §5, §8, §9, §11, §12 and §14, `challenge.md` §8.4 and `roadmap.md` updated with the decisions below.
- Tokens and the `share`, `wifi`, `wallet` and `copy` icons.
- `--color-on-brand-orange` becomes `var(--color-white)`, so every orange button has a white label like Spin's own platform (added during implementation, user decision).
- A `SupportReference` primitive with a "Copiar" button. It replaces every existing "Referencia: …" line in Home, the wizard and the auth alert.
- `proxy.ts` keeps an incoming `x-request-id` when it is a valid UUID.
- API client: the `timeout` failure kind, `timeoutMs`, a client-supplied request id and the `Idempotency-Key` header. A `MutationCache` handles `UNAUTHORIZED` like the `QueryCache` does.
- `TransferView` moves to `src/shared/lib/api/views.ts`.
- `useCreateTransfer`, the status lookup, a pure outcome mapper and a submission state machine.
- A "Procesando" modal dialog, the five outcome screens, and a "Todavía no encontramos tu envío" state after a lookup that finds nothing.
- Home cache invalidation and clearing the draft after a success.
- The receipt at `/transfers/[transferId]`: SSR in `<Suspense>`, a skeleton, `not-found`, the 520 px focus column and "Compartir comprobante".
- Home's `transfer_out` movement rows link to their receipt.
- A DEV scenario panel in the private layout, as a new `dev-tools` feature, for both scenario cookies.
- Messages, MSW handlers, E2E for the five outcomes and the lookup, and a "Confirmation and receipt" section in `CLAUDE.md`.

**Out of scope (for future specs):**

- `README.md`, `DECISIONS.md`, `AI_USAGE.md`, the Vercel deploy and the final accessibility and coverage review (SPEC 09).
- Applying `mock_read_scenario` to the receipt (user decision). The receipt reads the services directly.
- Automatic polling after a timeout. The user triggers each lookup.
- A shareable public receipt link, a PDF or an image of the receipt.
- A receipt for received transfers (`transfer_in`). The transfer belongs to the sender, and `getById` answers `404` to anyone else.
- Cancelling a transfer that is in flight.
- Raising Vercel's function duration for the 12 s scenario (SPEC 00 §19 already documents it).

## Data model

### Request id (`src/shared/lib/api/request-id.ts`, `src/proxy.ts`)

```ts
export function isRequestId(value: string | null): value is string;
export function createRequestId(): string;
```

- `isRequestId` accepts a lowercase or uppercase UUID (8-4-4-4-12 hex) and nothing else. `createRequestId` returns `crypto.randomUUID()`.
- `proxy.ts` uses the incoming `x-request-id` when `isRequestId` accepts it, and generates one otherwise. Validating the format keeps arbitrary text out of the logs. A client-chosen id only labels the client's own request.
- `createRouteHandler` does not change: it already reads the header that the proxy forwards.

### API client (`src/shared/lib/api/api-client.ts`)

```ts
export const API_FAILURE_KIND = { API: "api", NETWORK: "network", TIMEOUT: "timeout", UNKNOWN: "unknown" } as const;

export type ApiFailure =
  | { kind: "api"; status: number; code: ApiErrorCode; requestId: string; details?: Record<string, ValidationCode[]>; balance?: Money }
  | { kind: "network"; requestId?: string }
  | { kind: "timeout"; requestId?: string }
  | { kind: "unknown"; status?: number; requestId?: string };

export interface ApiRequestInit {
  signal?: AbortSignal;
  timeoutMs?: number;
  requestId?: string;
  idempotencyKey?: string;
}
```

- `requestId` is sent as `x-request-id` and `idempotencyKey` as `Idempotency-Key`. `network` and `timeout` echo the `requestId` that was sent, because no response carries one.
- `timeoutMs` creates an `AbortController` that a `setTimeout` aborts, linked to the caller's `signal`. A fake timer can drive it in tests. An abort caused by the timer is `timeout`. An abort caused by the caller's signal is `network`. The timer is cleared once a response arrives.
- `getRequestId(error)` returns the `requestId` of any kind that has one.
- `apiGet`, `apiPost` and `apiGetOrThrow` keep their signatures. The new fields are optional.
- `query-provider.tsx` adds `new MutationCache({ onError: handleQueryError })`, so an `UNAUTHORIZED` mutation clears the client session and goes to `/login`, as a query does.

### Wire types (`src/shared/lib/api/views.ts`)

`TransferView` moves here unchanged from `src/server/services/views.ts`, which re-exports it, as SPEC 06 and 07 did with the other views. The receipt and the submission hook need it on the client.

### Routes (`src/shared/lib/routes.ts`)

```ts
export function transferReceiptRoute(transferId: TransferId): Route;
```

It returns `` `/transfers/${transferId}` ``. `resolveRouteAccess` does not change: `/transfers/**` is already private.

### Transfer requests (`src/features/transfers/api/`)

```ts
export const TRANSFER_TIMEOUT_MS = 8000;

export function buildTransferPayload(draft: ValidTransferDraft): {
  amountInCents: Cents;
  recipient: { kind: "contact"; contactId: ContactId };
  concept?: string;
};
```

- `transfer-requests.ts` holds `buildTransferPayload`, a pure function. It omits `concept` when it is empty and uses `TRANSFER_RECIPIENT_KIND.CONTACT`, so the same draft always yields the same body. The server's payload hash then matches on every retry.
- `use-create-transfer.ts` is a `useMutation` over `apiPost<TransferView>("/api/v1/transfers", payload, { timeoutMs: TRANSFER_TIMEOUT_MS, idempotencyKey, requestId })`. It takes a fresh `createRequestId()` per attempt and never retries by itself. It throws `ApiFailureError` on failure, so the `MutationCache` sees `UNAUTHORIZED`.
- `use-transfer-lookup.ts` is a `useMutation` over `apiGet<TransferView>("/api/v1/transfers?idempotencyKey=…")`, with the same timeout and a fresh request id. It is a mutation because the user triggers it, and its result is never cached.

### Outcomes (`src/features/transfers/submission/types.ts`)

```ts
export const TRANSFER_OUTCOME = {
  NETWORK_ERROR: "network_error",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  TIMEOUT: "timeout",
  NOT_FOUND_YET: "not_found_yet",
  UNKNOWN_ERROR: "unknown_error",
} as const;

export type TransferOutcome =
  | { kind: "network_error"; requestId?: string }
  | { kind: "insufficient_funds"; amount: Money; balance?: Money }
  | { kind: "timeout"; requestId?: string }
  | { kind: "not_found_yet"; requestId?: string }
  | { kind: "unknown_error"; requestId?: string };

export const SUBMISSION_STATUS = {
  IDLE: "idle", PROCESSING: "processing", CHECKING: "checking", FAILED: "failed", SUCCEEDED: "succeeded",
} as const;

export type SubmissionState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "checking" }
  | { status: "failed"; outcome: TransferOutcome }
  | { status: "succeeded"; transfer: TransferView };
```

`submission/outcome.ts` holds two pure functions, each an exhaustive `switch` with `assertUnreachable`:

| `toTransferOutcome(failure, amount)` | Outcome |
| --- | --- |
| `network` | `network_error` |
| `timeout` | `timeout` |
| `api` + `UPSTREAM_UNAVAILABLE` | `network_error` |
| `api` + `INSUFFICIENT_FUNDS` | `insufficient_funds` with `failure.balance` |
| `api` + `INTERNAL_ERROR`, `VALIDATION_ERROR`, `NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `FORBIDDEN`, `UNAUTHORIZED` | `unknown_error` |
| `unknown` | `unknown_error` |

| `toLookupOutcome(failure)` | Outcome |
| --- | --- |
| `api` + `NOT_FOUND` | `not_found_yet` |
| `network`, `timeout`, any other `api` code, `unknown` | `not_found_yet`, with the reference (user decision) |

- Every `unknown_error` is sent to `getErrorReporter().captureException` with `source: ERROR_SOURCE.BROWSER`, the `requestId` and the `code`.
- `UNAUTHORIZED` maps to `unknown_error` only for completeness: the `MutationCache` redirects first.

### Submission state (`src/features/transfers/submission/`)

- `submission-store.ts` is a non-persisted Zustand store, `{ state: SubmissionState; set(state): void; reset(): void }`. It is emptied by `onClientSessionClear`, like the draft. It is a store, not local state, because `WizardShell` must hide its chrome while an outcome shows.
- `use-transfer-submission.ts` returns `{ state, submit(draft), checkStatus(), retry(), dismiss() }`:
  - `submit` ignores calls while `processing` or `checking`, so a double click never sends twice. It sets `processing`, calls `useCreateTransfer`, and ends in `succeeded` or `failed`.
  - `retry` calls `submit` again with the same draft, and so with the same `Idempotency-Key` (user decision). Only the request id changes.
  - `checkStatus` sets `checking` and calls the lookup with the draft's key. A `200` is handled like a success. Anything else sets `failed` with its `toLookupOutcome`.
  - `dismiss` sets `idle`. "Cambiar monto" uses it.
- On a success, or on a lookup that finds the transfer:
  - `queryClient.invalidateQueries({ queryKey: walletQueryKeys.all })` refreshes the summary and every movements filter;
  - the state becomes `succeeded`;
  - `router.replace(transferReceiptRoute(transfer.id))` runs, so back does not return to the review.
- On `insufficient_funds` with a `balance`, the cached `walletQueryKeys.summary()` gets that balance through `setQueryData`. The amount step then validates against it.
- `TransferConfirmation` resets the draft and the submission store when it unmounts in `succeeded`. Resetting on unmount means the step guard never sees an empty draft while the receipt loads. On any other unmount, only the submission store is reset. The draft and its key survive "Volver al inicio" (user decision), so a later retry stays idempotent.
- `hooks/use-prevent-unload.ts` adds a `beforeunload` listener while the status is `processing` or `checking`.

### Outcome screens (`src/features/transfers/components/transfer-outcome/`)

`TransferOutcome` is an exhaustive `switch` over `outcome.kind`. Each case renders an icon circle, a title, a text, its actions and, where the design draws it, a `SupportReference`. On mount, focus moves to the title (`tabIndex={-1}`), and the block has `role="alert"`.

| Kind | Icon and tone | Title | Actions (primary first) | Reference |
| --- | --- | --- | --- | --- |
| `network_error` | `wifi`, danger | "Se perdió la conexión" | "Reintentar envío" (`retry`), "Volver al inicio" (ghost) | Yes |
| `insufficient_funds` | `wallet`, danger | "Saldo insuficiente" | "Cambiar monto" (`dismiss` + amount step), "Volver al inicio" (ghost) | No, as drawn |
| `timeout` | `clock`, warning | "Está tardando más de lo normal" | "Revisar estado del envío" (`checkStatus`), "Volver al inicio" (ghost) | Yes |
| `not_found_yet` | `clock`, warning | "Todavía no encontramos tu envío" | "Revisar de nuevo" (`checkStatus`), "Reintentar envío" (secondary, `retry`), "Volver al inicio" (ghost) | Yes |
| `unknown_error` | `alert`, danger | "Algo salió mal" | "Volver al inicio" | Yes |

- The `insufficient_funds` text is conditional (user decision):
  - with `balance < amount`, the design's text with both amounts;
  - with any other balance, "No pudimos completar el envío por falta de saldo. Tu saldo disponible es {balance}.";
  - with no balance, "No pudimos completar el envío por falta de saldo."
- "Volver al inicio" is a `Button` with `href={ROUTES.HOME}`. It is primary only in `unknown_error`, so each screen has exactly one orange button.
- Below `lg`, the block is centered like the design's `state` and the actions are stacked full width. From `lg`, it is a white card in the 520 px focus column, aligned to the top, with the actions side by side at 50 % (secondary or ghost left, primary right). In `not_found_yet`, "Volver al inicio" sits under the row as a ghost link.

### Processing dialog (`src/features/transfers/components/processing-dialog/`)

- A native `<dialog>` opened with `showModal()` while the status is `processing`, `checking` or `succeeded`. It stays open until the receipt replaces the review. The `cancel` event is prevented, so Esc does not close it (user decision).
- `aria-busy="true"` and `aria-labelledby` point to its title. A spinner ring with `role="progressbar"` and `aria-label` "Procesando" sits above the title.
  - `processing` and `succeeded`: "Enviando {amount} a {firstName}" and "Esto toma unos segundos. No cierres esta ventana."
  - `checking`: "Revisando el estado de tu envío" and the same text.
- Below `lg` it fills the viewport (explicit `height: 100%`, as `BottomSheet` documents). From `lg` it is a centered card capped at `--container-form`, over the review with a dimmed backdrop. Under `prefers-reduced-motion` the ring does not spin.

### Confirmation wiring

- `components/transfer-confirmation/` is the client component `review/page.tsx` renders instead of `ReviewStep`. It calls `useTransferSubmission` and renders:
  - `ReviewStep` with `onConfirm={submit}` while `idle`, `processing`, `checking` or `succeeded`, plus `ProcessingDialog`;
  - `TransferOutcome` while `failed`.
- `ReviewStep`'s `onConfirm` becomes required. The `confirmUnavailable` alert and its message key are deleted.
- `WizardShell` reads the submission store. While `failed`, it renders only `children`, inside a `max-w-focus` column aligned to the top: no `AppBar`, `ProgressSteps`, H1, `Stepper` or "Cancelar". The design's results show no wizard chrome.
- A reload during an outcome loses the outcome (the store is not persisted) and shows the review with the same draft and key. Confirming again is safe.

### Receipt (`src/app/(private)/transfers/[transferId]/`, `src/features/transfers/components/`)

| File | Content |
| --- | --- |
| `page.tsx` | Static shell; `<Suspense fallback={<ReceiptSkeleton />}>` around `ReceiptSection`; metadata title "Comprobante" |
| `_sections/receipt-section.tsx` | Async Server Component: awaits `params`, calls `getSession()` (`redirect(ROUTES.LOGIN)` without one), calls `getServices().transfer.getById(userId, transferId)`, calls `notFound()` when it fails, and otherwise renders `TransferReceipt` |
| `not-found.tsx` | `ReceiptNotFound`: "No encontramos este comprobante", "Revisa el enlace o vuelve al inicio." and "Volver al inicio" |

- The receipt reads the services directly, not through `runReadScenario` (user decision). After a real success it always appears.
- `components/transfer-receipt/` (client):
  - a success icon circle (`check`), with the title "¡Envío exitoso!" in `role="status"` and focus moved to it on mount;
  - the amount (`--text-size-amount` on mobile, `--text-size-balance` from `lg`, `tabular-nums`);
  - the date from `formatReceiptDate` ("21 oct 2026, 10:42 h");
  - a `SummaryList` with "Para", "Cuenta" (`{accountType} •••• 1234` plus the bank when there is one), "Concepto" (only when set), "Folio" and "Clave de rastreo".
- Actions:
  - "Compartir comprobante" (secondary, `share` icon) and "Volver al inicio" (primary);
  - below `lg` they are stacked in `ActionBar`;
  - from `lg` they sit side by side at 50 % in the card's footer, which is a white card with `--shadow-card` and `--space-10` padding in the 520 px focus column.
  - The mobile receipt has no `AppBar`, as drawn.
- `hooks/use-share-receipt.ts` builds the `transfers.receipt.shareText` text from the masked view: amount, recipient, masked account, folio, tracking key and date (user decision).
  - With `navigator.share`, it shares `{ title, text }` and ignores an `AbortError`, which means the user cancelled.
  - Otherwise it calls `navigator.clipboard.writeText(text)` and announces "Comprobante copiado" in a `role="status"` region.
  - If neither works, it announces "No pudimos compartir el comprobante".
  - No URL and no full account number is shared.
- `components/receipt-skeleton/` is shaped like the card. `components/receipt-not-found/` reuses `WizardState`'s look.

### Movement row link (`src/features/wallet/components/movement-row/`)

- A row with `type === MOVEMENT_TYPE.TRANSFER_OUT` and a `transferId` wraps its content in a `next/link` to `transferReceiptRoute(transferId)` (user decision). It gets a `lavender-100` hover over `--duration-fast` and the focus ring. Other rows do not change.
- The `<li>` stays the list item and the link fills it, so the accessible name is the row's text.

### Support reference (`src/shared/ui/support-reference/`)

| Props | Behavior |
| --- | --- |
| `requestId: string` | "Referencia: `<code>{requestId}</code>`" at `--text-size-xs` (12 px), then a ghost "Copiar" button with a 44 px hit area and `aria-label` "Copiar referencia" |

- "Copiar" calls `navigator.clipboard.writeText`. Its label becomes "Copiado" for `COPY_FEEDBACK_MS` (`2000`, in `types.ts`), announced through `role="status"`. A rejection shows "No se pudo copiar".
- It replaces the reference line in:
  - `movements-state`, `summary-error`, `wizard-state` and `retry-alert`;
  - `auth-failure-alert`.

  `common.reference` and `auth.…reference` are deleted once nothing uses them.

### DEV panel (`src/features/dev-tools/`)

- A new feature, added to `FEATURES` in `eslint.config.mjs` so it obeys the same boundaries.
- `scenario-cookies.ts`:
  - `readScenarioCookies()` parses `document.cookie`.
  - `writeScenarioCookie(name, value | null)` writes `name=value; Path=/; SameSite=Lax`, or `Max-Age=0` for `null`.
  - The names come from `SCENARIO_COOKIE`, and the values from `TRANSFER_SCENARIO` and `READ_SCENARIO`.
- `components/dev-panel/` (client):
  - Collapsed, it is a 44 px dark pill reading "DEV · {transfer scenario}".
  - Below `lg` it starts at the bottom left, `--size-dev-panel-offset` (168 px) above the bottom edge, so it clears the review's two-button `ActionBar` (raised from 96 px during implementation, user decision). It is draggable with a pointer (touch or mouse) anywhere inside the viewport, kept `--space-2` from every edge; a move under 6 px still counts as a tap. The position is remembered in `localStorage` under `smw.dev-panel-position` (a per-viewer convenience, wrapped in `try`/`catch`) and clamped again when the viewport changes (user decision, added during implementation).
  - From `lg` it is fixed at the bottom right, `--space-4` from both edges, and cannot be dragged; a stored mobile position is ignored there (user decision, added during implementation).
  - The expanded card opens above the pill when the pill sits in the lower half of the viewport and below it otherwise, aligned to the pill's left edge in the left half and its right edge in the right half. From `lg` it always opens above and right-aligned.
  - `drag-position.ts` holds the pure `clampPosition` and `placementFor` functions behind this, and `hooks/use-draggable-position.ts` the pointer handling.
  - Expanded, it is an `ink-900` card with two native labeled `<select>`s:
    - "Envío": "Aleatorio" (clears `mock_scenario`) plus the five scenarios;
    - "Lecturas": "Normal" (clears `mock_read_scenario`) plus `slow`, `error` and `movements_error`.
  - A "Restablecer" button clears both. Changing "Lecturas" calls `queryClient.invalidateQueries()`, so the client blocks refetch with the new scenario at once.
  - The pill and its controls render on the client only after mount, because `document.cookie` does not exist on the server.
- `(private)/layout.tsx` renders `<DevPanel />` inside `QueryProvider` only when `getEnv().NEXT_PUBLIC_ENABLE_DEV_TOOLS` and `getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE` are both `true`. A panel whose cookies the server ignores would mislead the evaluator.
- `playwright.config.ts` sets `NEXT_PUBLIC_ENABLE_DEV_TOOLS: "false"` explicitly. A local `.env.local` therefore never puts the pill over the buttons that the E2E tests click.
- `docs/dev-panel.md` documents how to enable the panel, how to use it and every use case with its steps and expected result (user decision, added during implementation).

### Formatting (`src/shared/lib/format/date.ts`)

`formatReceiptDate(iso)` returns "21 oct 2026, 10:42 h" in `America/Mexico_City`. It is built from `Intl.DateTimeFormat#formatToParts`, so the output does not depend on the runtime's punctuation.

### UI primitives and icons (`src/shared/ui/`)

| Component | Change |
| --- | --- |
| `Icon` | Gains `share`, `wifi` and `wallet` from the design's symbols, and `copy` (two offset rounded rectangles, same 2 px stroke) |
| `SupportReference` | New, above |

### Tokens (`src/app/globals.css`, SPEC 00 §14)

| CSS token | Value | Usage |
| --- | --- | --- |
| `--container-focus` | `520px` | Results and receipt column; Tailwind `max-w-focus` |
| `--size-result-icon` / `--size-result-icon-lg` | `48px` / `64px` | Receipt success icon on mobile and from `lg` |
| `--size-dev-panel-offset` | `168px` | DEV pill bottom offset below `lg`, clearing a two-button `ActionBar` |

The outcome icon circle and the processing ring reuse `--size-state-icon` (56 px).

### Messages

`src/messages/es-MX/transfers.json` gains:

| Key | es-MX |
| --- | --- |
| `transfers.metaTitles.receipt` | "Comprobante" |
| `transfers.processing.sending` / `checking` / `text` / `progress` | "Enviando {amount} a {name}" / "Revisando el estado de tu envío" / "Esto toma unos segundos. No cierres esta ventana." / "Procesando" |
| `transfers.outcomes.networkError.title` / `text` | "Se perdió la conexión" / "Tu envío no se realizó y no se hizo ningún cargo. Revisa tu conexión e inténtalo otra vez." |
| `transfers.outcomes.insufficientFunds.title` / `changed` / `simulated` / `generic` | "Saldo insuficiente" / "Tu saldo cambió mientras enviabas. Hoy tienes {balance} disponibles y el envío es de {amount}." / "No pudimos completar el envío por falta de saldo. Tu saldo disponible es {balance}." / "No pudimos completar el envío por falta de saldo." |
| `transfers.outcomes.timeout.title` / `text` | "Está tardando más de lo normal" / "No recibimos respuesta a tiempo. Antes de reintentar, revisa el estado de tu envío para saber si se hizo." |
| `transfers.outcomes.notFoundYet.title` / `text` | "Todavía no encontramos tu envío" / "Puede tardar unos segundos más. Revisa de nuevo; si sigue sin aparecer, reintenta: no se te cobrará dos veces." |
| `transfers.outcomes.unknownError.title` / `text` | "Algo salió mal" / "No pudimos completar tu envío. Inténtalo más tarde. Si el problema sigue, comparte esta referencia con soporte." |
| `transfers.outcomes.actions.retry` / `checkStatus` / `checkAgain` / `changeAmount` / `home` | "Reintentar envío" / "Revisar estado del envío" / "Revisar de nuevo" / "Cambiar monto" / "Volver al inicio" |
| `transfers.receipt.title` / `to` / `account` / `concept` / `folio` / `trackingKey` | "¡Envío exitoso!" / "Para" / "Cuenta" / "Concepto" / "Folio" / "Clave de rastreo" |
| `transfers.receipt.share` / `shareTitle` / `shareText` / `shared` / `shareFailed` / `home` | "Compartir comprobante" / "Comprobante de envío Spin" / "Envié {amount} a {name} ({account}) el {date}. Folio: {folio}. Clave de rastreo: {trackingKey}." / "Comprobante copiado" / "No pudimos compartir el comprobante" / "Volver al inicio" |
| `transfers.receipt.notFound.title` / `text` | "No encontramos este comprobante" / "Revisa el enlace o vuelve al inicio." |

`transfers.review.confirmUnavailable` is deleted.

`common.json` gains `common.supportReference.label` / `copy` / `copyLabel` / `copied` / `copyFailed`: "Referencia:" / "Copiar" / "Copiar referencia" / "Copiado" / "No se pudo copiar".

A new `devTools.json` namespace, registered in `index.ts`, holds `devTools.toggle` / `title` / `transfer` / `read` / `random` / `normal` / `reset`: "Panel DEV" / "Escenarios simulados" / "Envío" / "Lecturas" / "Aleatorio" / "Normal" / "Restablecer". It also has one label per scenario value under `devTools.transferScenarios.*` and `devTools.readScenarios.*`.

### Tests setup

- `src/test/factories/transfers.ts` builds `TransferView`s.
- `msw/handlers.ts` gains `POST /api/v1/transfers` (`201` by default) and `GET /api/v1/transfers?idempotencyKey=` (`404` by default). Tests override them per outcome.
- `e2e/fixtures/scenario.ts` gains `setTransferScenario(context, value)` and `clearTransferScenario(context)`.
- `e2e/fixtures/wizard.ts` gains `reachReview(page, amount, contactName)` and `transferMovementCount(page, transferId)`. The second counts the `transfer_out` movements with that `transferId` through `page.request` on `/api/v1/wallet/movements`. The tests share one database, so they assert "debited once" by count, never by an exact balance.
- Added during implementation: `e2e/fixtures/auth.ts` gains `registerUser(page)`, and every confirmation test sends money from a user it registers itself ($1,000, no contacts), with `reachReview` saving the contact through the form. Other specs assert Mariana's exact balance and movement count, so the confirmation tests never transfer from a seed user. `playwright.config.ts` raises `expect.timeout` to 10 s for the parallel load.

## Implementation plan

Each step leaves lint, typecheck and tests green and is committed on its own. Before writing a step, read the relevant guide in `node_modules/next/dist/docs/`:

- `03-api-reference/03-file-conventions/dynamic-routes.md` and `not-found.md`;
- `03-api-reference/04-functions/not-found.md`, `redirect.md` and `use-router.md`;
- `03-api-reference/03-file-conventions/proxy.md`;
- `01-getting-started/08-caching.md`, for the `params` read inside `<Suspense>`.

1. **Docs.** The branch already exists. In SPEC 00, update:
   - §4: the receipt row reads the services directly, and the outcomes live on the review route;
   - §5: `features/dev-tools/` and `features/transfers/submission/`;
   - §8: a valid client `x-request-id` is kept, and `TransferView` moves to `shared/lib/api/views.ts`;
   - §9: the `not_found_yet` lookup state, and the DEV panel needs both flags;
   - §11: the proxy request-id rule;
   - §12: the `timeout` kind and the `MutationCache`;
   - §14: the tokens.

   In `challenge.md` §8.4, record that "Compartir comprobante" ships as shared text, "Copiar" ships on every reference, and the 520 px focus column ships. Link this spec from `roadmap.md` and mark 08 as in progress.
   - Why: other sessions read these files, not this chat.

2. **Tokens, icons and `SupportReference`.** Add the tokens and the four icons. Create `support-reference/` and the `common.supportReference` keys. Replace the five existing reference lines, then delete the keys nothing uses. Tests:
   - the icons render;
   - "Copiar" writes the id and shows "Copiado", which returns to "Copiar" after `COPY_FEEDBACK_MS`;
   - a rejected clipboard shows "No se pudo copiar";
   - the existing Home, wizard and auth tests still find "Referencia".
   - Why: every outcome screen uses it, and the references stay consistent across the app.

3. **Request id.** Create `request-id.ts` and make `proxy.ts` keep a valid incoming UUID. Tests: `isRequestId` accepts a UUID and rejects `""`, `"abc"` and a UUID with a trailing newline. A proxy test checks that a valid header is echoed and an invalid one is replaced.
   - Why: timeout and offline screens need a reference that matches the server log.

4. **API client.** Add `timeout`, `timeoutMs`, `requestId` and `idempotencyKey`. Update `getRequestId` and add the `MutationCache`. Tests with fake timers:
   - a response after `timeoutMs` becomes `timeout` with the sent request id;
   - an earlier response clears the timer;
   - a caller abort is `network`;
   - both headers are sent;
   - a mutation failing with `UNAUTHORIZED` calls `clearClientSession` and goes to `/login`.
   - Why: the client contract the submission builds on.

5. **Views, route, format and fixtures.** Move `TransferView`. Add `transferReceiptRoute`, `formatReceiptDate`, the transfers factory and the MSW handlers. Tests: `formatReceiptDate("2026-10-21T16:42:00.000Z")` is "21 oct 2026, 10:42 h", and the route builds `/transfers/trf_x`.
   - Why: the shapes and helpers every later step imports.

6. **Requests and outcome mapping.** Create `transfer-requests.ts`, `use-create-transfer.ts`, `use-transfer-lookup.ts`, `submission/types.ts` and `submission/outcome.ts`. Tests:
   - `buildTransferPayload` omits an empty concept and returns equal bodies for equal drafts;
   - every row of both mapping tables, including the `default` branch with an invalid kind;
   - `unknown_error` reports once with the request id;
   - the mutation sends the draft's `Idempotency-Key` and a fresh request id each call.
   - Why: the PDF's five outcomes as pure, testable code before any UI.

7. **Submission state machine.** Create `submission-store.ts`, `use-transfer-submission.ts` and `use-prevent-unload.ts`. Tests over MSW:
   - a success invalidates `["wallet"]` and replaces to the receipt;
   - a second `submit` while processing sends nothing;
   - `retry` reuses the key with a new request id;
   - `insufficient_funds` writes the returned balance into the summary cache;
   - a timeout then a `404` lookup ends in `not_found_yet`, and a `200` lookup ends in success;
   - `beforeunload` is registered only while processing or checking;
   - logging out empties the store.
   - Why: the flow that guarantees one charge per intent.

8. **Processing dialog.** Create `processing-dialog/`. Tests:
   - it opens with `showModal` and shows "Enviando $100.00 a Carlos";
   - Esc does not close it;
   - it has `aria-busy` and the progressbar label;
   - `checking` shows its own title.
   - Why: blocks double submission and navigation, as the design asks.

9. **Outcome screens.** Create `transfer-outcome/`. Tests:
   - each kind renders its title, actions and reference (none on `insufficient_funds`), and its buttons call the right handler;
   - the three insufficient-funds texts;
   - exactly one primary button per kind;
   - focus moves to the title;
   - the `default` branch.
   - Why: PDF screen 4's non-success half.

10. **Confirmation wiring.** Create `transfer-confirmation/`. Make `onConfirm` required, delete the note and its key, render `TransferConfirmation` from `review/page.tsx`, and add the focus mode to `WizardShell`. Tests:
    - "Confirmar envío" is enabled with a valid draft and opens the dialog;
    - a failure hides the stepper and the app bar and shows the outcome;
    - "Cambiar monto" opens the amount step with the draft intact;
    - "Volver al inicio" keeps the draft and its key;
    - a success resets the draft once the component unmounts.
    - Why: plugs the flow into the slot SPEC 07 left.

11. **Receipt.** Create `transfer-receipt/`, `receipt-skeleton/`, `receipt-not-found/`, `use-share-receipt.ts`, the page, the section and `not-found.tsx`. Tests:
    - the rows, with "Concepto" only when set, and the folio and tracking key;
    - `navigator.share` receives text with no URL;
    - without it, the clipboard receives the text and "Comprobante copiado" is announced;
    - an `AbortError` is ignored;
    - the title has `role="status"`.

    Manual check: a success lands on the receipt, which survives a reload, and a foreign id shows the not-found screen.
    - Why: PDF "show a receipt or success screen".

12. **Movement link.** Make `transfer_out` rows with a `transferId` link to their receipt. Tests: such a row is a link to `/transfers/{id}`, and `transfer_in`, cash deposit, QR payment and a `transfer_out` without an id are not links.
    - Why: the receipt stays reachable after leaving it (user decision).

13. **DEV panel.** Create `features/dev-tools/` and add it to `FEATURES`. Add `devTools.json` and render the panel from the private layout under both flags. Tests:
    - choosing "Tiempo de espera" writes `mock_scenario=timeout`;
    - "Aleatorio" clears it;
    - "Lecturas → Error" writes `mock_read_scenario=error` and invalidates queries;
    - "Restablecer" clears both;
    - the pill shows the active scenario read from `document.cookie`;
    - below `lg`, dragging the pill moves it and clamps it to the viewport, a short move still toggles it, and the position survives a remount;
    - from `lg`, the pill does not move;
    - `clampPosition` and `placementFor` for every edge and quadrant.

    Then write `docs/dev-panel.md` (added during implementation, user decision).
    - Why: the evaluator can force each outcome in the deployed demo.

14. **E2E.** Set `NEXT_PUBLIC_ENABLE_DEV_TOOLS: "false"` in `playwright.config.ts`, extend the fixtures, and create `e2e/transfer-confirmation.spec.ts`. Cover:
    - `success`: the receipt with "¡Envío exitoso!", a `SPN-\d{8}` folio and a `/transfers/trf_…` URL survives a reload; Home's matching movement opens it; "Enviar dinero" then starts with an empty amount;
    - `network_error`: the screen shows "Referencia" and "Copiar"; switching the cookie to `success` and pressing "Reintentar envío" reaches the receipt with `transferMovementCount` equal to 1;
    - `insufficient_funds`: the balance text shows; "Cambiar monto" opens the amount step with the amount kept;
    - `timeout`: after 8 s the timeout screen shows; "Revisar estado del envío" right away shows "Todavía no encontramos tu envío"; after the server's 12 s, "Revisar de nuevo" reaches the receipt with a count of 1;
    - `unknown_error`: "Algo salió mal" with a reference;
    - a foreign or invalid id shows "No encontramos este comprobante";
    - on `desktop`, the receipt sits in the 520 px column; on `mobile`, its actions sit in the bottom action bar.
    - Why: proves the five scenarios, idempotency and both layouts in a real browser.

15. **Docs.** Add a "Confirmation and receipt" section to `CLAUDE.md`. It covers:
    - the submission state machine and the outcome mappers;
    - the idempotency and request-id rules;
    - draft reset on unmount;
    - the receipt reading services directly;
    - `SupportReference`;
    - the DEV panel and its two flags.

    Remove the SPEC 07 lines that say SPEC 08 still has to add these pieces. Mark SPEC 08 as `Implemented` in `roadmap.md` once the criteria pass.
    - Why: SPEC 09 documents the project from these notes.

## Acceptance criteria

- [x] SPEC 00 §4, §5, §8, §9, §11, §12 and §14 and `challenge.md` §8.4 describe the decisions of this spec.
- [x] `POST /api/v1/transfers` from the review sends `Idempotency-Key` equal to the draft's key and an `x-request-id` that is a UUID. The response echoes that same `x-request-id`.
- [x] A request with `x-request-id: not-a-uuid` gets a different, generated id in its response.
- [x] Pressing "Confirmar envío" twice quickly sends exactly one request.
- [x] While the request is pending, a modal dialog shows "Enviando {amount} a {name}", Esc does not close it, and leaving the page asks for confirmation.
- [x] With `mock_scenario=success`, the browser lands on `/transfers/{id}`, which shows "¡Envío exitoso!", the amount, the date in "21 oct 2026, 10:42 h" format, "Para", "Cuenta", "Folio" and "Clave de rastreo".
- [x] Reloading the receipt shows the same data, and the browser's back button from it does not return to the review.
- [x] After a success, Home shows the reduced balance and the new movement without a manual reload, and "Enviar dinero" starts with an empty draft.
- [x] With `mock_scenario=network_error`, "Se perdió la conexión" shows with "Reintentar envío", "Volver al inicio" and "Referencia: …". Retrying under `success` produces exactly one `transfer_out` movement for that transfer.
- [x] With `mock_scenario=insufficient_funds`, "Saldo insuficiente" shows the available balance, and "Cambiar monto" opens the amount step with the previous amount.
- [x] With `mock_scenario=timeout`, the timeout screen shows after 8 s ± 1 s with a reference. A lookup before the server finishes shows "Todavía no encontramos tu envío", and a lookup after it reaches the receipt with exactly one movement.
- [x] With `mock_scenario=unknown_error`, "Algo salió mal" shows with only "Volver al inicio" and a reference.
- [x] Every outcome screen has exactly one orange button, moves focus to its title, and shows no app bar, stepper or "Cancelar".
- [x] After "Volver al inicio" from a failed outcome, returning to the review shows the same idempotency key in `sessionStorage`.
- [x] "Copiar" next to any reference (Home, wizard, login, outcomes) copies the id and shows "Copiado".
- [x] "Compartir comprobante" shares or copies a text containing the folio and the masked account, and containing no URL and no account number with more than 4 digits.
- [x] Opening `/transfers/trf_does_not_exist`, or another user's transfer id, shows "No encontramos este comprobante" with "Volver al inicio".
- [x] On Home, a sent-transfer movement is a link to its receipt, and received, cash and QR movements are not links.
- [x] With both `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` and `MOCK_ALLOW_SCENARIO_OVERRIDE=true`, the private pages show the "DEV" pill. Choosing a transfer scenario forces it on the next confirmation, and with either flag `false` the pill is absent. Below 1024 px the pill can be dragged anywhere inside the viewport and keeps its place after a reload; from 1024 px it stays at the bottom right and cannot be moved. `docs/dev-panel.md` lists every use case with its steps and expected result.
- [x] From 1024 px the receipt and the outcomes sit in a 520 px column aligned to the top, with the actions side by side. Below 1024 px the receipt's actions sit in the bottom action bar.
- [x] The "Confirmar envío" note from SPEC 07 and its message key no longer exist.
- [x] Every touch target added in this milestone is at least 44 × 44 px, and no text is smaller than 12 px.
- [x] `support-reference` lives in `src/shared/ui/` with `.tsx`, `.test.tsx`, `.module.scss` and `types.ts`, and no SCSS file has a hex value or a loose measured value.
- [x] `npm run test:e2e` passes on the `mobile` and `desktop` projects.
- [x] `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100 % on `src/domain/**`, 80 % on `src/server/**`, `src/shared/lib/**` and `src/shared/observability/**`) and `npm run build` finish with no errors.
- [x] No component or page contains user-facing text outside `src/messages/es-MX/`.
- [x] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** the "Procesando" state is a native modal `<dialog>`, full screen on mobile and centered over the review on desktop, with Esc blocked and a `beforeunload` guard (user decision). It matches both drawings and blocks a double click and navigation for free.
- **No:** replacing the review's content with a spinner. The app bar and the stepper would stay clickable during the request.
- **Yes:** a 404 or a failure on the status lookup shows "Todavía no encontramos tu envío", with "Revisar de nuevo" and "Reintentar envío" (user decision). The server commits at 12 s, so a 404 at 9 s is not proof that the transfer failed.
- **No:** treating a lookup 404 as a definitive failure. It is false in the very scenario it is meant for.
- **No:** automatic polling after a timeout. Each lookup is a deliberate user action, and polling adds timers to test for little gain.
- **Yes:** retrying from `network_error` and `not_found_yet` resends at once with the same `Idempotency-Key` and a new request id (user decision). The server's replay check and payload hash guarantee a single charge.
- **Yes:** a conditional insufficient-funds text (user decision). The design's two-amount text shows when the balance really is below the amount, and the simulated case reads honestly.
- **Yes:** the returned `balance` is written into the summary cache. "Cambiar monto" then validates against the server's figure.
- **Yes:** the draft and its key survive a failed outcome and "Volver al inicio" (user decision). After a network error or a timeout, the client cannot know whether a charge happened. A fresh key on a later retry could pay twice.
- **Yes:** the draft is reset when the confirmation unmounts after a success, not before the navigation. Resetting earlier would make the review's step guard redirect to the amount step while the receipt loads.
- **Yes:** the outcome lives in a non-persisted store. `WizardShell` needs it to switch to the focus column, and a reload falls back safely to the review.
- **Yes:** unrecognized API errors (`409`, `400`, `404`, `403`) fall back to `unknown_error` and are reported. The design says "cualquier respuesta no reconocida cae aquí".
- **Yes:** the client generates the `x-request-id` for transfer requests, and `proxy.ts` keeps an incoming one that is a valid UUID (user decision). Timeout and offline screens then have a reference that matches the server's `api_request` log line.
- **No:** showing the `Idempotency-Key` as the reference. It is not what the logs are keyed by, so support could not correlate it.
- **Yes:** "Compartir comprobante" shares a text built from the masked receipt, through `navigator.share`, falling back to the clipboard (user decision). The receipt URL is private, and the text never carries a full account.
- **No:** sharing the receipt URL. The recipient would only see the login page.
- **Yes:** a `SupportReference` primitive with "Copiar", used for every reference in the app (user decision). The mobile review asks for it, and one component keeps the 12 px minimum and the copy behavior consistent.
- **Yes:** the receipt reads `getServices().transfer.getById` directly, with no read scenario (user decision). After a real success the receipt must always show, and SPEC 00 §4 already makes it dynamic SSR.
- **Yes:** `notFound()` for a missing or foreign transfer. The service already scopes by user, and a 404 never reveals that a foreign id exists.
- **Yes:** `transfer_out` movement rows link to their receipt (user decision). The receipt stays reachable after leaving it. `transfer_in` stays plain, because that receipt belongs to the sender.
- **Yes:** a global DEV panel in the private layout that drives both scenario cookies (user decision). It demonstrates Home's and the wizard's read states, not only the five outcomes.
- **Yes:** a collapsible 44 px pill instead of the drawn fixed bar (user decision). A fixed bar would cover `ActionBar` on mobile.
- **Yes:** the pill is draggable below `lg` and fixed at the bottom right from `lg` (user decision, added during implementation). On a phone no single spot clears every screen's controls, so the evaluator moves it out of the way; on desktop the bottom right is free on every private page and a fixed spot needs no explanation.
- **Yes:** the panel renders only when `NEXT_PUBLIC_ENABLE_DEV_TOOLS` and `MOCK_ALLOW_SCENARIO_OVERRIDE` are both on. SPEC 00 only requires the first, but a panel whose cookies the server ignores would mislead.
- **Yes:** the panel is a `dev-tools` feature under the ESLint boundaries. It has app behavior (cookies, query invalidation), so it does not belong in `shared/ui`.
- **Yes:** Playwright pins `NEXT_PUBLIC_ENABLE_DEV_TOOLS=false`. E2E tests force scenarios through cookies, and a local `.env.local` must not put the pill over the buttons they click.
- **Yes:** the timeout is an `AbortController` aborted by `setTimeout`, not `AbortSignal.timeout`. Fake timers can drive it in unit tests.
- **Yes:** `useCreateTransfer` and the lookup throw `ApiFailureError`, and a `MutationCache` handles `UNAUTHORIZED`. An expired session mid-confirmation behaves like an expired session on Home.
- **Yes:** `onConfirm` becomes required, and the "Pronto podrás confirmar" note is deleted. The slot is filled now, so the disabled branch would be dead code.
- **Yes:** `db.read` takes the same process-wide lock as `transaction` (found by the E2E suite, added during implementation). On Windows a read holding the JSON file open made a concurrent transaction's `rename` fail with `EPERM`; transactions are short (the scenario waits run outside them), so serializing reads costs nothing noticeable.
- **Yes:** white labels on the orange buttons (user decision, added during implementation). Spin's platform uses them, and the brand must match. White on `#FF6600` is 2.9:1, below AA for normal text; the trade-off is accepted knowingly and replaces option A (`ink-900`, 5.1:1) from SPEC 05.

## Risks

| Risk | Mitigation |
| --- | --- |
| A retry while the first timed-out request is still sleeping on the server charges twice | Same `Idempotency-Key` and payload: whichever request commits first stores the key, and the other returns the stored transfer. E2E asserts one movement |
| An offline `fetch` that throws mid-flight did reach the server, but the screen says "no se hizo ningún cargo" | SPEC 00 §9 maps it to the network UI. A retry reuses the key, so at worst the stored transfer is returned |
| Resetting the draft before the receipt loads triggers the step guard | The reset runs on unmount after `succeeded`; tested in step 10 |
| An empty `concept` serialized differently on a retry changes the payload hash and answers `409` | `buildTransferPayload` always omits an empty concept; tested for equal output |
| The DEV pill covers a CTA | Offset above `ActionBar` and draggable below `lg`, bottom right from `lg`, collapsed by default, off in Playwright |
| The 12 s timeout E2E exceeds the default test timeout | That test raises its own timeout to 30 s |
| `params` read outside `<Suspense>` breaks prerendering | `ReceiptSection` awaits `params` inside the boundary; `npm run build` is an acceptance criterion |
| The clipboard or Web Share API is unavailable | Each action has a failure message in `role="status"` instead of throwing |
| The 12 s scenario outlives a Vercel function | Already documented in SPEC 00 §19; demonstrated locally and in E2E |

## What is **not** in this spec

- `README.md`, `DECISIONS.md`, `AI_USAGE.md`, the deploy and the final accessibility and coverage review (SPEC 09).
- Read scenarios on the receipt, and automatic polling after a timeout.
- A public receipt link, a PDF or image export, and receipts for received transfers.
- Cancelling an in-flight transfer.
- Raising Vercel's function duration.

Each of them lands in the milestone listed in `specs/roadmap.md`, or stays out of the project.
