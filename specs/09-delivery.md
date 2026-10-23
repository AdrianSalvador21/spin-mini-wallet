# SPEC 09 — Final quality, deploy and documentation

> **Status:** Approved
> **Depends on:** SPEC 00, SPEC 01, SPEC 02, SPEC 03, SPEC 04, SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-10-22
> **Objective:** Fix the defects a pre-delivery audit found, remove dead scope, ship the approved brand improvements in the flow, deploy to Vercel, and explain every decision through the repo docs and a Spin-branded Spanish presentation exported to PDF.

**Branch:** `feature/09-delivery`, created from `develop` once the SPEC 08 PR is merged into it (`AutoCreateBranch: false`), and merged back through a PR to `develop`.

## Why this spec exists

Milestones 01 to 08 cover every screen, rule and scenario of the PDF. A pre-delivery audit on 2026-10-22 (lint, typecheck, 1,041 unit tests, 97 % coverage, every spec read against the code) found that the code works but the delivery does not yet:

- **Deliverables missing.** `README.md` is still the `create-next-app` boilerplate. `DECISIONS.md` and `AI_USAGE.md` do not exist. The SSR/CSR, state and E2E justifications the PDF asks for live only in 4,300 lines of specs.
- **Two server defects in the transfer contract.**
  - `createTransferSchema.amountInCents` is `z.number()`. A `POST` with `10.5` passes and leaves a fractional balance, and `MAX_AMOUNT_IN_CENTS` is enforced only on the client.
  - The handler runs the scenario draw before any business rule. Under `network_error`, `unknown_error` or `insufficient_funds`, an amount of 0, an amount over the balance or a foreign `contactId` answers a simulated 503, 500 or 422 instead of a real 400, 404 or 422. That breaks SPEC 00 §7 (three enforcement points) and §9 ("Invalid input always gets a real 400 before any scenario applies").
- **Dead scope.** `TransferRecipientInput`'s `kind: "new"` branch has a schema, service logic and tests, but no client ever sends it: since SPEC 07, every new recipient is saved through `POST /api/v1/contacts` first.
- **Minor defects.**
  - `INVALID_CURSOR` is not a `ValidationCode`; it is forced with `as unknown as`.
  - A failed `rename` leaves orphan `.tmp` files in `.data/`.
  - Lint warns about `window.location.assign` in `query-provider.tsx`.
  - Closed-set literals (`"completed"`, `"INSUFFICIENT_FUNDS"`) are written raw in `transfer-service.ts`.
  - `TRANSFER_FEE` feeds "Saldo después" but not `validateTransfer`.
- **Brand improvements approved after SPEC 08.** On 2026-10-22 the user approved a third design pass, "Spin Mini Wallet · Marca en mobile" (`https://claude.ai/artifact/61hP4ttWPTCChC2GH2MBVR`). It carries Spin's identity through the whole flow: the logo and a rings texture on the key screens, a branded processing state, and a ticket-style receipt.
- **Deploy risk.** On Vercel each instance has its own `/tmp`, so a user registered on one instance does not exist on another. A valid session cookie for a user who does not exist today ends in a broken Home error state.

## Scope

**In:**

- SPEC 00, `roadmap.md` and `CLAUDE.md` updated with the decisions below.
- Server contract fixes:
  - an integer, bounded `amountInCents`;
  - the three business rules, contact ownership and the self-transfer check run in the handler after the idempotency replay check and before the scenario draw.
- `TransferRecipientInput` reduced to a contact reference: `kind` and the `"new"` branch are removed everywhere.
- Minor fixes:
  - `CURSOR_INVALID` becomes a real `ValidationCode` with its message;
  - the temp file is cleaned up when a write fails;
  - the lint warning is removed;
  - a `TRANSFER_STATUS` constant replaces the raw `"completed"`, and `TRANSFER_RULE_VIOLATION` replaces the raw rule-violation literals;
  - `TRANSFER_FEE` is included in the sufficient-balance rule.
- Ghost-session handling: a valid session whose user does not exist clears the cookie and lands on `/login`, never on an error screen.
- Brand improvements in the flow, from the approved canvas: Home proposal B, login and side navigation, the processing orbit, the ticket receipt, and the wizard's "Cancelar envío" as an X button. They are recorded in `challenge.md` §8 as the third design approval, and explained in `DECISIONS.md`.
- Vercel deploy, with the environment documented.
- `README.md`, `DECISIONS.md` and `AI_USAGE.md` in the repo root, in English.
- `docs/architecture.md`, `docs/flows.md` and `docs/state.md` with Mermaid diagrams, plus a `docs/README.md` index. `docs/dev-panel.md` stays.
- A short `specs/README.md` explaining the spec-driven workflow and the reading order.
- A presentation in Spanish, built as a **Design** artifact (a canvas of artboards, not a doc and not slides) with Spin's brand, and exported to PDF. It is sent by the user alongside the repository link and is not committed (user decision).

**Out of scope (for future specs):**

- New tests for `use-wallet-summary`, `use-movements`, `use-share-receipt`, `use-transfer-balance` and `contact-list`. They are listed under "what I would do with more time" in `DECISIONS.md`.
- An automated accessibility audit (axe). Accessibility is documented, not re-tested.
- Simplifying the DEV panel's drag, removing the preview store or removing `experimental.agentFeedback`. They stay and are explained.
- Removing the SSR read latency on Home. It stays and is documented.
- Changing the simulated `insufficient_funds` behavior or copy. It stays and is documented.
- A shared persistent store (Redis, Upstash, a real database) for Vercel.
- Merging `develop` into `main`. The user does it before submitting (see Risks).

## Data model

### Amount on the wire (`src/domain/money/money.ts`, `src/domain/transfer/schemas.ts`)

A new pure validator. It lives next to `parseAmount` because it guards the same cents invariant for a number that already arrived as cents:

```ts
export function validateAmountInCents(value: number): Result<Cents, ValidationCode>;
// not an integer (10.5, NaN, Infinity) → "AMOUNT_INVALID_FORMAT"
// > MAX_AMOUNT_IN_CENTS                → "AMOUNT_EXCEEDS_MAXIMUM"
// 0 and negatives pass here: AMOUNT_NOT_POSITIVE stays a business rule in validateTransfer
```

`createTransferSchema.amountInCents` becomes `z.number()` piped through a transform that applies this validator, with the `ValidationCode` as the issue message, like `fromValidator`. A non-number keeps Zod's own issue and still answers `400`.

### Recipient (`src/domain/transfer/types.ts`, `src/domain/transfer/rules.ts`)

```ts
export interface TransferRecipient {
  contactId: ContactId;
}

export interface TransferDraft {
  amount: Money;
  recipient: TransferRecipient | null;
}

export const TRANSFER_STATUS = { COMPLETED: "completed" } as const;
export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];
```

`TRANSFER_RECIPIENT_KIND`, `TransferRecipientInput` and the `"new"` schema branch are deleted. The `POST /api/v1/transfers` body becomes:

```json
{ "amountInCents": 15000, "recipient": { "contactId": "ctc_…" }, "concept": "Renta" }
```

`buildTransferPayload` and the MSW handlers follow. `Transfer.recipient` (the stored `{ name, account }` snapshot) does not change.

### Sufficient-balance rule (`src/domain/transfer/rules.ts`)

`validateTransferAmount` compares `amount + TRANSFER_FEE` against the balance. With the fee at `$0.00`, no behavior changes. The rule and "Saldo después" can no longer disagree.

### Validation codes (`src/domain/shared/validation-codes.ts`, `src/messages/es-MX/errors.json`)

Add `CURSOR_INVALID`, named like `LIMIT_INVALID` and `DIRECTION_INVALID`, with the message "El cursor de paginación no es válido." `wallet-service.ts` returns `details: { cursor: ["CURSOR_INVALID"] }` with no cast.

### Transfer pre-check (`src/server/services/transfer-service.ts`)

```ts
export interface TransferService {
  check(userId: UserId, input: CreateTransferInput): Promise<Result<void, ServiceError>>;
  create(userId: UserId, input: CreateTransferInput, idempotencyKey: string): Promise<Result<TransferView, ServiceError>>;
  getById(userId: UserId, transferId: TransferId): Promise<Result<TransferView, ServiceError>>;
  findByIdempotencyKey(userId: UserId, key: string): Promise<Result<TransferView, ServiceError>>;
}
```

`check` and `create` share one private function over `Repositories`. That function resolves the contact (`NOT_FOUND` when missing or foreign), rejects the user's own phone (`VALIDATION_ERROR`, `recipient: ["RECIPIENT_IS_SELF"]`) and runs `validateTransfer` (`INSUFFICIENT_FUNDS` with `balance`, or `VALIDATION_ERROR` with the rule codes). `check` runs it under `db.read`. `create` runs it again inside its transaction, which stays the check that decides.

`POST /api/v1/transfers` order (replaces SPEC 00 §9's list):

1. CSRF and content type.
2. Session.
3. `Idempotency-Key` format.
4. Payload schema.
5. Idempotency replay.
6. **`transfer.check`**, which returns the real `400`, `404` or `422` on failure.
7. Scenario draw.

The replay runs before `check` on purpose: a replayed success was already debited, so re-checking the balance would turn a valid retry into a false `422`.

### Ghost session (`src/server/`, `src/app/`, `src/shared/lib/`)

- `AuthService.exists(userId: UserId): Promise<boolean>`.
- `createRouteHandler`: after `requireSession()`, a session whose user does not exist answers `401 UNAUTHORIZED`, like a missing session.
- `ROUTES.SESSION_END = "/session/end"`. The route `src/app/session/end/route.ts` is a `GET` Route Handler that deletes `smw_session` and redirects to `/login`. `resolveRouteAccess` already treats it as neither public-only nor private, so it is reachable with or without a session.
- `SessionGuard` (`src/app/(private)/_components/session-guard.tsx`): an async Server Component rendered by the private layout inside `<Suspense fallback={null}>`. It calls `redirect(ROUTES.SESSION_END)` when the session's user does not exist.
- `query-provider.tsx`: on `UNAUTHORIZED`, clear the client session and navigate to `ROUTES.SESSION_END` without `window.location.assign`. The navigation stays a full page load, because the target is a Route Handler, not a page.

### Brand improvements (`specs/challenge.md` §8, approved canvas)

The source is the canvas "Spin Mini Wallet · Marca en mobile" (`https://claude.ai/artifact/61hP4ttWPTCChC2GH2MBVR`). Implementation reads each artboard's `project/*.dc.html` with the Artifact `read` action. Approved artboards:

- `Propuesta-B-Home`, `Login`, `Wizard`, `Procesando` and `Comprobante` (mobile);
- `Desktop-Home`, `Desktop-Wizard`, `Desktop-Comprobante` and `Desktop-Login`.

`Main` ("Propuesta A") is discarded and `Actual-Home` is the before state; neither is built.

**Assets.** They are downloaded from the canvas's asset store into `public/assets/shared/`:

| File | Canvas asset | Use |
| --- | --- | --- |
| `spin-rings.svg` | `09a2745eaad1d6ad68b535169c8b20d1` | Decorative texture, always `alt=""` and `aria-hidden` |
| `spin-oxxo-logo-color.svg` | `cef2edede887d849edec93452363640c` | Logo on light backgrounds (Home header, receipt card, processing) |
| `spin-oxxo-logo.svg` (existing, white) | `4411e798e4233d55982416c89dc5f941` | Logo on purple surfaces; kept, replaced only if the canvas file differs |

`BrandLogo` picks the color file when `onDark` is false and the white file when it is true, so call sites keep their API.

**Shared decoration.** A `BrandRings` primitive (`src/shared/ui/brand-rings/`) renders the texture as an absolutely positioned, non-interactive `<img alt="" aria-hidden="true">`. Its props:

- `placement: RingsPlacement` (`as const`: `TOP_RIGHT`, `BOTTOM_RIGHT`, `BOTTOM_LEFT`, `TOP_LEFT`);
- `size: RingsSize` (`as const`: `SM`, `MD`, `LG`).

Its opacity is the token `--opacity-rings`. The parent sets `position: relative; overflow: hidden`.

**Per screen:**

| Screen | Change |
| --- | --- |
| Home, below `lg` (proposal B) | `HomeHeader` loses the purple gradient: a light header with the color logo, a purple `Avatar` button and "Hola, {name}". `BalanceCard` becomes the purple gradient card on mobile too: "Saldo disponible", the eye toggle in white, the amount, the masked phone (`summary.user.maskedPhone`) and the white logo, with `BrandRings`. "Enviar dinero" (with the send icon) moves out of the card and sits below it |
| Home, from `lg` | The aside's gradient balance card gains `BrandRings`, the masked phone and the white logo; the rest stays as is |
| `SideNav` from `lg` | The white logo at the top (`xl`; the rail keeps its icon-only layout), `BrandRings` at the bottom left, and the current item gets an orange indicator (`box-shadow: inset` with `--size-nav-indicator`) besides `aria-current="page"` |
| Login and register below `lg` | `BrandRings` in the purple header, and the logo at `--size-logo-md`. The copy does not change |
| `AuthBrandPanel` from `lg` | `BrandRings` behind the existing content and the orange ring |
| `ProcessingDialog` | The plain ring becomes the "orbit": an inline SVG of two orange arcs and a dot rotating around a lavender circle with the send icon, plus the color logo at the bottom. The `role="progressbar"`, the `aria-label` and the copy stay |
| `TransferReceipt` (mobile and from `lg`) | A purple gradient band behind the top of the page with `BrandRings`, and the card styled as a ticket: the color logo above the success icon, two side notches and a dashed divider between the head and the `SummaryList`. Actions, copy and focus behavior stay |
| `WizardShell` | "Cancelar" leaves the card head. Below `lg` it becomes a 44 px X icon button on the right of the `AppBar` (`aria-label` "Cancelar envío"); from `lg` it is an X + "Cancelar envío" link to the right of the H1. Both keep `onClick={reset}` and go to `/home`; it stays hidden in focus mode |

**Motion.** The orbit turns once per `--duration-orbit` (`1.1s`). Under `prefers-reduced-motion: reduce` it slows to `--duration-orbit-reduced` (`3s`) instead of stopping, exactly as in the canvas (user decision). SPEC 00 §14's motion rule records this one exception.

**Tokens** (added to `globals.css` and SPEC 00 §14):

- `--opacity-rings` (`0.14`);
- `--size-orbit` (`132px`) and `--size-orbit-core` (`64px`);
- `--size-nav-indicator` (`3px`);
- `--size-ticket-notch` (`24px`);
- `--size-receipt-band` (`220px` mobile, `240px` from `lg`);
- `--duration-orbit` and `--duration-orbit-reduced`.

Every other value maps to an existing token. A value the canvas uses that no token describes becomes a new token, never a loose `px`.

**Messages.** `transfers.actions.cancelAria` ("Cancelar envío") and `home.balance.account` (an ICU "Celular {masked}"). `common.brand.logoAlt` is reused for both logos.

### Docs layout

```text
README.md            run, demo users, scenarios, scripts, libraries, limitations, deploy, time spent
DECISIONS.md         structure, UI/logic split, rendering, state, rules, edge cases, trade-offs, more time
AI_USAGE.md          tools, spec-driven workflow, accepted / corrected / rejected, author's decisions
docs/README.md       index of docs/
docs/architecture.md layers, folders, boundaries, backend pipeline, data model
docs/flows.md        sequence diagrams: login, Home SSR + hydration, transfer (success, retry, timeout + lookup)
docs/state.md        client state map, submission state machine, wizard step guard, route access
docs/dev-panel.md    unchanged
specs/README.md      what the specs are, the /spec → /spec-impl workflow, reading order
```

Every diagram is Mermaid in a fenced `mermaid` block, so GitHub renders it with no build step.

### Presentation (Design artifact, outside the repo)

- **Type:** the account's "Design" Artifact type (`https://claude.ai/artifact/QKN21svewxgyPb6SYRqWnd`). It is created with `type_url`, titled "Spin Mini Wallet — Presentación técnica", and kept private.
- **Artboards:** 14, each 1920 × 1080 (16:9). Each artboard becomes one PDF page.
- **Language:** Spanish (es-MX). Code identifiers, routes and file paths stay as written in the code.
- **Brand:** there is no published Spin design system, so the brand comes from the repo:
  - the color, radius, shadow and font tokens in `src/app/globals.css` (SPEC 00 §14): `--color-brand-purple` `#531BC8`, `--color-brand-purple-2` `#7549D3`, `--color-brand-orange` `#FF6600`, the lavender and ink scales, Montserrat 800 for headings and Open Sans for body;
  - the purple gradient header and the orange ring from `specs/design/mini-wallet-design.html`;
  - the logo at `public/assets/shared/spin-oxxo-logo.svg`.
  Orange marks one highlight per artboard, as it marks one CTA per screen in the app.
- **Diagrams:** redrawn by hand as on-brand SVG or HTML (Spin colors, fonts and radii). They carry the same content as the Mermaid diagrams in `docs/`, but they are not Mermaid output.
- **Artboard order:**

| # | Artboard | Content | Source |
| --- | --- | --- | --- |
| 1 | Portada | Title, logo, author, date, repository link | — |
| 2 | El reto y qué se entregó | The four PDF screens and each one's status, the deliverables, the time spent (two days, about 10 hours) | `challenge.md`, README |
| 3 | Stack | Each library with a one-line reason | SPEC 00 §3, README |
| 4 | Arquitectura en capas | Layer diagram plus the ESLint boundary rules | `docs/architecture.md` |
| 5 | Backend simulado | Pipeline diagram: proxy → `createRouteHandler` → service → repositories → JSON with lock and atomic write | `docs/architecture.md` |
| 6 | Modelo de datos | Entity diagram (users, wallets, movements, contacts, transfers, idempotencyKeys), money in cents, branded IDs | `docs/architecture.md` |
| 7 | Reglas de negocio | The three rules, where they run (client, handler, service), `Result` and error codes | DECISIONS §2 |
| 8 | Flujo de una transferencia | Sequence: success, retry with the same `Idempotency-Key`, the 8 s timeout plus the status lookup | `docs/flows.md` |
| 9 | Los 5 escenarios | Weight, server behavior and UI for each, plus forcing them with the DEV panel | SPEC 00 §9, `docs/dev-panel.md` |
| 10 | Estado del cliente | Map of TanStack Query, the draft, the submission and the URL/cookie, plus the submission state machine | `docs/state.md` |
| 11 | Rendering | Per route: SSR, CSR or Server Action, and why | DECISIONS §3 |
| 12 | Calidad y testing | Unit, E2E and CI, with the real counts at delivery time | `npm run test:coverage`, `e2e/` |
| 13 | IA y metodología SDD | Tools; the `/spec` → questions → decisions → approval → `/spec-impl` step by step with a review and OK per step; corrections and rejections; the author's decisions | `AI_USAGE.md` |
| 14 | Limitaciones y siguientes pasos | Known limitations, plus what I would do with more time | README, DECISIONS §13–14 |

- **Output:** the PDF is saved as `spin-mini-wallet-presentacion.pdf` in the session's scratchpad and handed to the user. It is never written into the repo.

## Implementation plan

Each step leaves lint, typecheck and tests green and is committed on its own after the user's OK. Before steps 4 and 5, read `node_modules/next/dist/docs/` for `route.md`, `redirect.md` and `cookies.md`.

1. **Docs alignment.** In SPEC 00, update:
   - §6: `TransferRecipient`, `TRANSFER_STATUS`;
   - §7: the handler's pre-check is the second enforcement point;
   - §8: the transfer body and `CURSOR_INVALID`;
   - §9: the new order;
   - §11: the ghost session;
   - §16: the Vercel environment;
   - §17: documentation rows point to 09;
   - §14: the brand tokens and the orbit's reduced-motion exception.

   In `challenge.md` §8, record the third design approval (2026-10-22, "Brand improvements in the flow", the canvas link and the per-screen table), and add a §8.4 row for each change. In `roadmap.md`, link this spec, rewrite the 09 summary to match this scope and mark 09 in progress.
   - Why: other sessions read these files, not this chat.
2. **Amount and status in the domain.** Add `validateAmountInCents`, wire it into `createTransferSchema`, add `TRANSFER_STATUS` and put the fee into `validateTransferAmount`. Tests:
   - `10.5`, `NaN` and `Infinity` give `AMOUNT_INVALID_FORMAT`;
   - `MAX_AMOUNT_IN_CENTS + 1` gives `AMOUNT_EXCEEDS_MAXIMUM`;
   - `0` and `-1` pass the validator;
   - the schema rejects `10.5` with that code;
   - a fee-sized fixture shows the rule counting the fee.

   The domain keeps 100 % coverage.
3. **Remove `kind: "new"`.** Replace `TransferRecipientInput` with `TransferRecipient` across the domain, schema, `transfer-service.ts` (drop the save-favorite branch), `transfer-requests.ts`, `review-step.tsx`, MSW handlers and tests. Tests:
   - `buildTransferPayload` sends `{ recipient: { contactId } }`;
   - the schema rejects a body that still sends `kind: "new"` with a name and an account (unknown shape → `400`).
4. **Pre-check in the handler.** Extract the shared check, add `transfer.check`, and call it in `create-transfer-handler.ts` between the replay and the draw. Use `TRANSFER_RULE_VIOLATION` and `TRANSFER_STATUS` instead of raw literals. Handler tests, each with the scenario forced to `network_error` so the draw would otherwise win:
   - amount `0` → `400` with `amountInCents: ["AMOUNT_NOT_POSITIVE"]`;
   - amount over the balance → real `422` with `balance`;
   - a foreign `contactId` → `404`;
   - the user's own phone contact → `400` `RECIPIENT_IS_SELF`;
   - `10.5` → `400` `AMOUNT_INVALID_FORMAT`;
   - a replay of a completed key with the same payload still returns `201` after the debit.
5. **Minor server fixes.** Add `CURSOR_INVALID` with its es-MX message and remove the cast. In `writeSnapshot`, remove the temp file when `writeFile` or `rename` throws, then rethrow. Tests:
   - an invalid cursor answers `400` with `cursor: ["CURSOR_INVALID"]`;
   - `errors.test.ts` passes;
   - a forced `rename` failure (target path is an existing directory) rejects and leaves no `.tmp` file in the folder.
6. **Ghost session.** Add `AuthService.exists`, the `401` in `createRouteHandler`, the `/session/end` Route Handler, `SessionGuard` and the `query-provider.tsx` navigation. Tests:
   - `exists` for a seeded and a missing id;
   - a route handler with a valid session for a missing user answers `401 UNAUTHORIZED`;
   - `GET /session/end` deletes `smw_session` and redirects to `/login`;
   - `handleQueryError` on `UNAUTHORIZED` clears the client session and navigates to `/session/end`;
   - `npm run lint` reports 0 problems.
7. **Brand assets, tokens and primitives.**
   - Download the three canvas assets into `public/assets/shared/`, then add the tokens and the messages.
   - Create `BrandRings` with its `types.ts`, and make `BrandLogo` pick the color or white file.
   - Tests:
     - `BrandRings` renders an `<img>` with `alt=""` and `aria-hidden="true"`, and a class per placement and size;
     - `BrandLogo` uses `spin-oxxo-logo-color.svg` by default and `spin-oxxo-logo.svg` with `onDark`;
     - existing logo tests still pass.
   - Why: every following step reuses them.
8. **Home proposal B and side navigation.** Restyle `HomeHeader`, `BalanceCard` and `SideNav` as in the Data model table. Tests:
   - below `lg` the header shows the logo and the avatar button, and no gradient class;
   - the balance card shows the masked phone and keeps the eye toggle's `aria-pressed`;
   - "Enviar dinero" is a link to `/transfers/new/amount` outside the card's section;
   - the current `SideNav` item keeps `aria-current="page"`;
   - `e2e/home.spec.ts` passes on both projects.
9. **Login, brand panel and processing.** Add `BrandRings` to the login and register headers and to `AuthBrandPanel`. Replace the `ProcessingDialog` ring with the orbit. Tests:
   - the dialog still has `role="progressbar"`, its `aria-label`, and the "Enviando $X a {name}" title;
   - the orbit's SVG is `aria-hidden`;
   - `e2e/auth.spec.ts` and the processing part of `e2e/transfer-confirmation.spec.ts` pass.
10. **Ticket receipt and the wizard's cancel.** Restyle `TransferReceipt` and the receipt page background. Move "Cancelar" to the X button (mobile) and the X link (desktop) in `WizardShell`. Tests:
    - the receipt keeps `role="status"`, the focus on its title and both actions;
    - the X button has `aria-label` "Cancelar envío", resets the draft and goes to `/home`;
    - it is not rendered in focus mode;
    - `e2e/transfer-wizard.spec.ts` and `e2e/transfer-confirmation.spec.ts` pass on both projects.
11. **`docs/architecture.md`.** Sections:
   - the layer diagram (`app` → `features` → `shared` → `domain`, and `server`), with the ESLint boundary rules beside it;
   - the folder map;
   - the backend pipeline as a flowchart (`proxy.ts` → `createRouteHandler`: request id, CSRF, session → handler → service → repositories → `JsonDatabase` with the lock and atomic write);
   - the data model as an `erDiagram` (users, wallets, movements, contacts, transfers, idempotencyKeys);
   - "Where to find…" (rules, scenarios, the error envelope, the API contract).
   Create `docs/README.md` listing every file in `docs/`.
12. **`docs/flows.md` and `docs/state.md`.**
   - `flows.md` has sequence diagrams for:
     - login (Server Action, rate limit, cookie, redirect);
     - Home (proxy, Suspense sections, home loader, `setQueryData`, `HydrationBoundary`, client pagination);
     - a transfer: success, `network_error` with a retry under the same `Idempotency-Key`, and `timeout` with the 8 s abort, the 12 s server commit and the status lookup.
   - `state.md` has:
     - a table of every piece of client state (TanStack Query caches, the persisted draft, the preview store, the submission store, the URL filter, the balance-visibility cookie) with where it lives and why;
     - the submission state machine as a `stateDiagram-v2`;
     - the step guard as a decision table;
     - the route-access table from `resolveRouteAccess`.
13. **`DECISIONS.md`.** It is written for a reviewer reading it in 10 minutes. Each item is one or two lines that link to `docs/` or a spec for depth. Sections:
   1. Project structure and why.
   2. How UI and business logic are separated: the domain, the three enforcement points, `Result`, and error codes instead of messages.
   3. Rendering per route (SSR, CSR, Server Actions), from SPEC 00 §4.
   4. State management: TanStack Query for server state, Zustand for the draft and the submission, URL and cookie for preferences; Redux and plain Context discarded.
   5. Services: Route Handlers for data, Server Actions for auth.
   6. Money, idempotency and the timeout lookup.
   7. Error handling and traceability.
   8. Testing strategy, and why Vitest and Playwright.
   9. The security baseline, framed as the minimum for production-quality code, not extra scope.
   10. Styling and i18n.
   11. Edge cases considered. At least:
       - a double click;
       - a reload mid-wizard;
       - a reload during an outcome;
       - a retry after a timeout;
       - an expired session mid-flow;
       - another user's draft in the same tab;
       - a self-transfer;
       - an existing contact saved again;
       - fractional or oversized amounts;
       - a balance that changed (the simulated `insufficient_funds`, explained as that race);
       - a partial Home failure;
       - a ghost session.
   12. Brand improvements in the flow: what changed after the third design approval (Home proposal B, rings texture, orbit, ticket receipt, X cancel) and why, so Spin's identity carries from login to the receipt. Includes the orbit's reduced-motion choice.
   13. Known trade-offs: the white-on-orange contrast, the SSR read latency, the DEV panel on in the deploy, the JSON file, and the in-memory rate limit.
   14. What I would do with more time, including the hook tests listed out of scope here and an axe audit.
14. **`AI_USAGE.md`.**
    - **Tools:** Claude.ai for the visual design and its iterations (the published artifact, the mobile review and the desktop proposal); Claude Code for specs, implementation, reviews and this audit.
    - **Method:** the spec-driven workflow. The challenge is transcribed into `challenge.md`, then SPEC 00 and the roadmap. Each milestone goes through `/spec`: context, question blocks, decisions with alternatives, the spec saved as Draft, then approved by the author. Then `/spec-impl` implements it step by step, with a review and the author's OK before each commit, iterations and corrections. Milestones 02 and 03 were split when they grew too big.
    - **Accepted directly:** examples.
    - **Corrected or rejected:** concrete examples from the specs' Decisions sections, the `fix:` commits and this audit.
    - **Decisions taken by the author:** a list.

    Draft it from those sources. The user reviews every item, and anything they do not recognize as theirs is removed before the commit.
15. **`README.md` and `specs/README.md`.** The README has:
    - what the app is;
    - requirements (Node 24, npm);
    - quick start (`cp .env.example .env.local`, set `SESSION_SECRET`, `npm ci`, `npm run dev`);
    - demo users (Mariana and Diego, `Spin2026`);
    - forcing scenarios (both flags, then link to `docs/dev-panel.md`);
    - scripts, including the `CI=true` E2E note while `npm run dev` runs;
    - libraries with one line each on why;
    - a short structure overview;
    - known limitations: the JSON file on Vercel (per-instance data, resets after idle, use the seed users), the ghost-session redirect, the simulated `insufficient_funds`, the 12 s timeout on serverless, the per-instance rate limit, the contrast trade-off, no recents or search, no real auth;
    - the deploy URL and its environment variables;
    - links to `DECISIONS.md`, `AI_USAGE.md`, `docs/` and `specs/`;
    - time spent: "Two days. About 10 hours of hands-on time, spent mostly on planning, iterating the specs, researching alternatives and design."

    `specs/README.md` explains the workflow and the reading order (`challenge.md`, `roadmap.md`, `00-architecture.md`, then each milestone).
16. **Vercel deploy.**
    - **User action:** create the Vercel project from the GitHub repo, with production branch `main`. Set for every environment, build included because `next.config.ts` calls `getEnv()`: `SESSION_SECRET` (a fresh random value of 32 characters or more), `MOCK_DB_PATH=/tmp/spin-mini-wallet/db.json`, `MOCK_ALLOW_SCENARIO_OVERRIDE=true` and `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`.
    - **Verification:** run the acceptance checks below against the preview deployment of `feature/09-delivery`.
    - Put the production URL into the README once `main` is merged.
17. **Presentation (no commit).** Run Artifact `quickstart` with intent `design`, then create the Design artifact from its `type_url` and follow the type's instructions.
    - Build the 14 artboards in the order of the Data model table, in Spanish, on brand.
    - Draw every diagram as on-brand SVG, from the final `docs/` content.
    - Read the real test and E2E counts from a fresh `npm run test:coverage` and `e2e/`, never from this spec.
    - Export to PDF: with the type's own export if it has one, or else by printing the canvas from the browser with one artboard per 1920 × 1080 page.
    - Check every page of the PDF, then hand the user the PDF and the artifact link.
    - The user reviews the content (especially artboard 13, the AI usage) before sending it.
18. **Close.** Add a "Delivery" section to `CLAUDE.md` (the ghost session, `/session/end`, `BrandRings`, the logo variants, the orbit motion exception, the docs map). Mark this spec `Implemented` and 09 done in `roadmap.md`.

## Acceptance criteria

- [ ] `npm run lint` reports 0 errors and 0 warnings.
- [ ] `npm run typecheck`, `npm run test:coverage` (domain at 100 %, the rest at 80 % or more) and `npm run test:e2e` pass.
- [ ] `POST /api/v1/transfers` with `amountInCents: 10.5` answers `400` with `amountInCents: ["AMOUNT_INVALID_FORMAT"]`, and no balance changes.
- [ ] `POST /api/v1/transfers` with `amountInCents: 0` and `mock_scenario=network_error` answers `400` `AMOUNT_NOT_POSITIVE`, not `503`.
- [ ] An amount over the balance with `mock_scenario=unknown_error` answers `422 INSUFFICIENT_FUNDS` with the real balance, not `500`.
- [ ] A foreign `contactId` with any forced scenario answers `404`.
- [ ] Replaying a completed transfer's key with the same payload answers `201` with the same transfer and no second debit.
- [ ] `grep -rn "TRANSFER_RECIPIENT_KIND\|kind: \"new\"" src` returns nothing.
- [ ] `grep -rn "as unknown as" src --include=*.ts --include=*.tsx`, excluding tests, returns only the `login-form.tsx` resolver cast.
- [ ] A `GET /api/v1/wallet/movements?cursor=bad` answers `400` with `cursor: ["CURSOR_INVALID"]`.
- [ ] A forced write failure leaves no `*.tmp` file next to the database.
- [ ] A valid session cookie for a user missing from the database:
  - lands on `/login` with the cookie cleared when opening `/home`;
  - gets `401` from `GET /api/v1/wallet/summary`.
- [ ] `public/assets/shared/` holds `spin-rings.svg`, `spin-oxxo-logo-color.svg` and `spin-oxxo-logo.svg`.
- [ ] Below `lg`, Home has a light header with the color logo and a purple avatar button. The balance card is the purple gradient with the rings, the masked phone and the white logo, and "Enviar dinero" sits outside the card.
- [ ] From `lg`, the side navigation shows the rings, and its current item has the orange indicator and `aria-current="page"`. At `xl` it also shows the logo.
- [ ] The login and register headers, and the desktop brand panel, show the rings texture.
- [ ] The processing dialog shows the orange orbit and the color logo. It turns once per 1.1 s, or once per 3 s under `prefers-reduced-motion: reduce`.
- [ ] The receipt is a ticket card (logo, notches, dashed divider) over a purple band with the rings, on mobile and in the 520 px focus column.
- [ ] The wizard has no "Cancelar" link in the card head. An X button labeled "Cancelar envío" sits in the mobile app bar, and an X link "Cancelar envío" sits next to the desktop H1.
- [ ] No SCSS file added or changed in this spec contains a hex color or a loose `px` value outside SPEC 00 §14's exceptions.
- [ ] `challenge.md` §8 lists the third design approval with the canvas link, and `DECISIONS.md` has the "Brand improvements in the flow" section.
- [ ] `README.md`, `DECISIONS.md` and `AI_USAGE.md` exist in the root, in English, and contain every section listed in steps 13 to 15.
- [ ] Following only the README's quick start on a fresh clone, `npm run dev` serves `/login`, and Mariana can log in.
- [ ] `docs/architecture.md`, `docs/flows.md` and `docs/state.md` exist, and every Mermaid block renders on GitHub.
- [ ] On the Vercel deployment:
  - Mariana logs in;
  - Home shows $12,450.80 or her current balance;
  - a transfer under `success` lands on the receipt;
  - each of the other four scenarios, forced from the DEV panel, shows its screen.
- [ ] The Design artifact exists, private, with exactly 14 artboards of 1920 × 1080, in the order of the Data model table.
- [ ] Every artboard's visible text is in Spanish, except code identifiers, routes and file paths.
- [ ] Artboards 4, 5, 6, 8 and 10 contain an on-brand diagram (no Mermaid rendering), and their content matches `docs/`.
- [ ] Every color in the presentation is one of SPEC 00 §14's tokens, and headings use Montserrat.
- [ ] The PDF has 14 pages, one per artboard, with no clipped content, and is not committed to the repo.

## Decisions

- **Yes:** fix the amount and pre-check defects before writing docs. A reviewer will try `curl` against a wallet API before reading `DECISIONS.md`.
- **Yes:** run the pre-check after the idempotency replay. A replayed success was already debited, so re-checking the balance would reject a legitimate retry.
- **Yes:** keep the service transaction as the deciding check, even with the handler pre-check. Between the two, another request can change the balance; only the check inside the lock is authoritative.
- **No:** putting `AMOUNT_NOT_POSITIVE` into the schema. It is one of the PDF's three business rules and must come from `validateTransfer`, so the same code reaches the client, the handler and the service.
- **Yes:** `recipient: { contactId }` instead of a single-member union. A union with one member is noise; a second recipient kind gets added when a real flow needs it.
- **No:** keeping `kind: "new"` "for API completeness". It is untested by any client, and it duplicated the contact-saving logic of `ContactService`.
- **Yes:** handle the ghost session by clearing the cookie through a Route Handler. Server Components cannot delete cookies, and redirecting to `/login` with the cookie still set would bounce back to `/home` through the proxy.
- **No:** checking user existence inside `proxy.ts` or `getSession()`. That would put a database read in front of every request and couple the session primitives to storage.
- **Yes:** Vercel with the JSON file and documented limitations (user decision). The seed users always exist on every instance, which is enough for the reviewer's demo.
- **No:** Redis, Upstash or a single-instance host. That is new infrastructure a day before the deadline, and it contradicts SPEC 00's JSON-only decision.
- **Yes:** keep the SSR read latency, the DEV panel drag, the preview store and the simulated `insufficient_funds` as they are, and explain them in `DECISIONS.md` (user decision).
- **Yes:** docs in English (user decision), consistent with the code, specs and commits.
- **Yes:** keep `specs/`, `CLAUDE.md` and `AGENTS.md` in the repo as evidence of the AI-assisted, spec-driven workflow, with `specs/README.md` as the entry point (user decision).
- **Yes:** every diagram and architecture explanation lives in `docs/`; `DECISIONS.md` stays short and links to it (user decision).
- **No:** an axe audit or the missing hook tests in this milestone. Both are listed under "more time"; the deadline goes to correctness and explainability.
- **Yes:** ship the brand improvements approved on 2026-10-22 in this milestone (user decision): Home proposal B, login and side navigation, the orbit, the ticket receipt and the X cancel. They bring Spin's identity to every step of the flow.
- **Yes:** build them after the server fixes and before the docs, so the docs and the presentation describe the final UI.
- **No:** Home proposal A (a purple header with the rings over a white balance card). The canvas marks it as discarded in favor of B.
- **Yes:** a `BrandRings` primitive with placement and size constants. The texture appears on five screens, and one component keeps it decorative (`alt=""`, `aria-hidden`) everywhere.
- **Yes:** `BrandLogo` chooses the color or white file from `onDark`. Call sites do not change, and a light background never gets a white logo.
- **Yes:** the orbit slows to 3 s under reduced motion instead of stopping, exactly as in the canvas (user decision). It is the one documented exception to SPEC 00 §14's motion rule, because a fully static indicator would read as frozen while money is moving.
- **Yes:** document the improvements in `challenge.md` §8 and `DECISIONS.md` (user decision). **No:** a before-and-after artboard in the presentation, which stays at 14 artboards.
- **Yes:** a Spanish presentation as a Design canvas, not a doc and not slides, so it carries Spin's brand (user decision). The repo docs stay in English for the code reader; the PDF is for the evaluators.
- **Yes:** 14 artboards at 16:9, an executive summary that points to the repo for depth. **No:** 20 or more artboards, which would not fit before the deadline. **No:** 8 artboards, which would drop the flows and the client state.
- **Yes:** diagrams redrawn on brand. **No:** pasting Mermaid output, whose generic look breaks the branded canvas.
- **Yes:** build the presentation after the repo docs, so both tell the same story and the counts are real.
- **No:** committing the PDF or linking the artifact from the README. The PDF travels with the link (user decision), and the artifact stays private as the editable source.
- **Yes:** declare "two days, about 10 hours hands-on" as the time spent (user's figure).

## Risks

| Risk | Mitigation |
| --- | --- |
| `main` only has the initial commit, so a reviewer opening the repo sees nothing | The user merges `develop` into `main` before sending the link. The README's links are relative, so they work on any branch |
| The Vercel build fails because `next.config.ts` calls `getEnv()` | Set `SESSION_SECRET` for every environment, build included (step 16) |
| A reviewer registers on one Vercel instance and the next request lands on another | The ghost-session redirect sends them to `/login` cleanly. The README says to demo with Mariana or Diego and explains why |
| Data resets after Vercel scales to zero | Documented. The seed always regenerates, so the demo always starts from a known state |
| The `timeout` scenario on serverless (12 s sleep) | Fluid compute allows it. If the instance stops early, the lookup shows "Todavía no encontramos tu envío", which is the designed behavior |
| `AI_USAGE.md` drafted by the AI claims decisions the author did not take | Built only from the specs' Decisions sections and commits, then reviewed line by line by the user |
| The brand restyle breaks E2E locators (Home greeting, "Cancelar", the receipt) | Steps 8 to 10 each run the affected Playwright specs on both projects, and locators use roles and labels, not classes |
| The canvas assets cannot be downloaded from the asset store | Export the SVGs from the canvas by hand and commit them; the color logo can fall back to the existing SVG with its fills recolored to `--color-brand-purple` |
| Brand work eats the time the docs need before 2026-10-24 | Steps 7 to 10 are each committable; if time runs out, step 10 is the first to defer, and the docs describe what shipped |
| The Design type has no native PDF export | Print the canvas from the browser with 1920 × 1080 pages, then check every page of the PDF |
| No published Spin design system | The brand comes from `globals.css` and the approved design HTML; the acceptance criteria limit colors to SPEC 00 §14's tokens |
| The presentation and the repo docs drift apart | The presentation is built last, from the final `docs/`, `DECISIONS.md` and `AI_USAGE.md` |
| Removing `kind: "new"` breaks an E2E fixture or an MSW handler | Step 3 runs the full unit suite. Step 18's acceptance run includes `npm run test:e2e` |

## What is **not** in this spec

- Tests for `use-wallet-summary`, `use-movements`, `use-share-receipt`, `use-transfer-balance` and `contact-list`.
- An automated accessibility audit.
- Simplifying the DEV panel, the preview store, `agentFeedback` or the SSR latency.
- Any change to the simulated `insufficient_funds` scenario.
- Shared persistence for Vercel.
- Merging `develop` into `main`, which the user does.
- Committing the presentation PDF or linking the artifact from the repo.

Each one of those, if it lands, goes in its own spec.
