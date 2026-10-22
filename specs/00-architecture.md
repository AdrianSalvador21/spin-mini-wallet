# SPEC 00 — Spin Mini Wallet architecture and global contracts

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-10-21
> **Objective:** Define the architecture, data model, API contracts, security, scalability and error traceability that every milestone must respect.

## 1. Why this spec exists

The challenge evaluates engineering decisions more than screens. This document fixes the global contract so every milestone can be implemented without reopening decisions. Milestone specs (01 to 08) describe **how** each delivery is built. This spec describes **what** the whole system is and **why**.

Sources:

- Requirements: `Web Challenge.pdf` (Spin by OXXO), transcribed in [`challenge.md`](./challenge.md).
- Approved design proposal: tokens, components and screens agreed in the planning session on 2026-10-21, kept in [`design/mini-wallet-design.html`](./design/mini-wallet-design.html) and summarized in `challenge.md` §8.
- Next.js 16.4.2 documentation bundled in `node_modules/next/dist/docs/`.

Project-wide rules:

- All code, identifiers, file names, branch names and commit messages are in English.
- Code has no comments.
- User-facing text is in Spanish (es-MX) and lives in message files, never in code.
- While executing each milestone step, the chat explains, in Spanish, what is being done and why.

## 2. Scope

**In:**

- Full flow: Login → Home → New transfer → Confirmation / Receipt, plus a Registration screen.
- Simulated backend with Route Handlers (`/api/v1/*`) and persistence in a local JSON file.
- The three business rules from the PDF, applied in the domain and validated on client and server.
- The five confirmation scenarios from the PDF with weighted random outcome and deterministic override.
- Unit testing (Vitest + Testing Library + MSW) and E2E (Playwright).
- Deliverables: `README.md`, `DECISIONS.md`, `AI_USAGE.md`, GitHub Actions CI and Vercel deploy.

**Out of scope (for future specs, if they ever land):**

- Real authentication (OTP, biometrics, MFA, password recovery).
- Dark mode.
- Languages other than es-MX (the i18n infrastructure is ready, only es-MX ships).
- A real database or durable persistence on Vercel.
- Real integration with Sentry or another provider (the interface is left ready).
- Transaction limits beyond the three PDF rules (daily maximums, fees).
- Editing and deleting contacts.
- Husky, lint-staged, commitlint and Prettier (discarded during planning).

## 3. Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js 16.4.2 (App Router) + React 19.3 + strict TypeScript 5.9 | PDF requirement; App Router combines SSR, streaming and Server Actions |
| Rendering | Cache Components + Partial Prefetching (already on in `next.config.ts`) | Immediate static shell with streamed dynamic data |
| Server state | TanStack Query 5 | Caching, retries, invalidation and infinite pagination without custom code |
| Client state | Zustand 5 (transfer draft only) | Minimal store, no provider, persistable to `sessionStorage` |
| Forms | React Hook Form + Zod 4 (`@hookform/resolvers`) | One schema validates on client and server |
| i18n | next-intl 4 (no locale prefix in URLs) | Works in Server and Client Components, typed messages, ICU formatting |
| Styling | Tailwind v4 (page layout) + SCSS Modules with BEM (components) | User decision: own styles in BEM, Tailwind only for layout |
| Unit tests | Vitest 5 + Testing Library + MSW 3 | Fast, native ESM, realistic network mocks |
| E2E tests | Playwright | Multi-browser, mobile emulation, scenarios forced via cookie |
| Runtime | Node 24 LTS, npm | Pinned with `.nvmrc` and `engines` |

## 4. Route map and rendering strategy

| Route | Access | Rendering | Rationale |
| --- | --- | --- | --- |
| `/` | — | Redirect in `proxy.ts` | Sends to `/home` with a session or to `/login` without one |
| `/login` | Public | Prerendered shell + client form + Server Action | No data dependency; submit mutates cookies on the server |
| `/register` | Public | Same as `/login` | Same pattern |
| `/home` | Private | Prerendered shell + dynamic sections in `<Suspense>` (SSR streaming); "Ver más" on the client | Balance arrives server-rendered with no initial spinner; pagination is a client interaction |
| `/transfers/new/amount` | Private | Client Component inside a static shell | Interactive wizard; depends on the balance in the TanStack Query cache |
| `/transfers/new/recipient` | Private | Client Component | Contact selection and creation |
| `/transfers/new/review` | Private | Client Component | Summary, confirmation and non-success outcomes |
| `/transfers/[transferId]` | Private | Dynamic SSR in `<Suspense>` | Receipt that can be reloaded and shared by URL |

Rules derived from Cache Components (doc `01-getting-started/08-caching.md`):

- Every read of `cookies()`, `headers()` or `searchParams` happens inside a `<Suspense>`.
- Data is dynamic by default; `use cache` is never used on per-user data.
- No route declares `export const runtime`.

Server Components get data by calling `src/server/services` directly, without HTTP calls to their own API. Client Components use the `/api/v1/*` Route Handlers through TanStack Query. Home prefetches on the server and hands over the hydrated cache (`HydrationBoundary`) so the client continues pagination without repeating the first load.

## 5. Folder structure

```text
src/
  app/                       routes, layouts, route handlers; no business logic
    (public)/login, (public)/register
    (private)/home, (private)/transfers/new/{amount,recipient,review}, (private)/transfers/[transferId]
    api/v1/...
  proxy.ts                   route guard + x-request-id
  instrumentation.ts         onRequestError → error reporter
  instrumentation-client.ts  global browser errors → reporter
  domain/                    pure TypeScript: types, rules, validators, Zod schemas
    money/ user/ wallet/ contact/ transfer/ shared/
  server/                    server only (import "server-only")
    db/ repositories/ services/ session/ mock/ http/
  features/                  UI + hooks + server actions per feature
    auth/ wallet/ transfers/
  shared/
    ui/                      primitives (button/, field/, alert/...) with .tsx + .module.scss + .test.tsx
    lib/                     api-client, formatting, utilities
    i18n/ observability/ config/ styles/
  messages/es-MX/            common.json, auth.json, home.json, transfers.json, errors.json
  test/                      setup, render with providers, MSW handlers, factories
e2e/                         Playwright specs and fixtures
```

Every component, in `shared/ui/` and in any `features/<x>/components/`, lives in its own kebab-case folder: `<name>/<name>.tsx`, `<name>/<name>.test.tsx`, `<name>/<name>.module.scss` when it has styles and `<name>/types.ts` when it declares closed-set constants (SPEC 05, user decision).

Dependency rules (enforced with ESLint `no-restricted-imports` from milestone 01):

- `domain/` imports nothing from `react`, `next`, `server/`, `features/` or `shared/ui`.
- `server/` may import `domain/` and `shared/{config,observability,lib}`; never `features/` or `shared/ui`.
- `features/<x>/` does not import from `features/<y>/`.
- Only `actions.ts` files in `features/` may import `server/`.
- `app/` composes `features/` and `shared/`; `route.ts` files call `server/services`.

## 6. Domain model

Conventions:

- Money in integer cents, never floats. Currency is always `MXN`.
- IDs are strings with branded types so they cannot be swapped.
- Dates travel as ISO 8601 in UTC and are formatted in `America/Mexico_City` only in the UI.
- Full account numbers never reach the client; API responses mask them (`•••• 5678`).

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, "UserId">;
type Cents = Brand<number, "Cents">;

interface Money { amountInCents: Cents; currency: "MXN" }

interface User {
  id: UserId; fullName: string; phone: string; email: string;
  passwordHash: string; createdAt: string;
}

interface Wallet { userId: UserId; balance: Money; updatedAt: string }

const MOVEMENT_TYPE = {
  TRANSFER_OUT: "transfer_out", TRANSFER_IN: "transfer_in",
  CASH_DEPOSIT: "cash_deposit", QR_PAYMENT: "qr_payment",
} as const;
const MOVEMENT_DIRECTION = { DEBIT: "debit", CREDIT: "credit" } as const;
type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];
type MovementDirection = (typeof MOVEMENT_DIRECTION)[keyof typeof MOVEMENT_DIRECTION];
interface Movement {
  id: string; userId: UserId; type: MovementType; direction: MovementDirection;
  amount: Money; counterpartyName?: string; merchantName?: string;
  transferId?: string; createdAt: string;
}

type RecipientAccount =
  | { type: "phone"; phone: string }
  | { type: "clabe"; clabe: string }
  | { type: "card"; cardNumber: string };

interface Contact {
  id: string; ownerId: UserId; name: string; account: RecipientAccount;
  isFavorite: boolean; createdAt: string;
}

type TransferRecipientInput =
  | { kind: "contact"; contactId: string }
  | { kind: "new"; name: string; account: RecipientAccount; saveAsFavorite: boolean };

interface Transfer {
  id: string; folio: string; trackingKey: string; senderId: UserId;
  recipient: { name: string; account: RecipientAccount };
  amount: Money; concept?: string; status: "completed";
  idempotencyKey: string; createdAt: string;
}

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Domain validators (`src/domain/*/validators.ts`):

- MX mobile number: exactly 10 digits after stripping spaces; displayed with the `+52` prefix.
- Email: Zod's simplified RFC format, normalized to lowercase.
- CLABE: 18 digits; digit 18 must match Banxico's 3-7-1 weighting algorithm.
- Card: 16 digits and the Luhn algorithm.
- Password: at least 8 characters, at least one uppercase letter and one number.
- Concept: optional, at most 40 characters.

## 7. Business rules

The three PDF rules are pure functions in `src/domain/transfer/rules.ts`:

| Violation code | Rule |
| --- | --- |
| `AMOUNT_NOT_POSITIVE` | The amount must be greater than zero |
| `INSUFFICIENT_FUNDS` | The amount cannot exceed the available balance |
| `RECIPIENT_REQUIRED` | A recipient must exist |

`validateTransfer(input, availableBalance): Result<ValidTransfer, TransferRuleViolation[]>` runs in three places:

1. On the client, inside each step's Zod schema, to guide the user with immediate messages.
2. In the `POST /api/v1/transfers` Route Handler, when validating the payload.
3. In `TransferService`, inside the write lock, right before debiting. This is the validation that decides.

The server is the source of truth. Client validation is UX; it never authorizes anything.

## 8. API contracts (`/api/v1`)

Every response is JSON. Every response includes the `x-request-id` header. Every private endpoint requires a valid session and responds `401` without one.

| Method and route | Description | Success |
| --- | --- | --- |
| `GET /api/v1/wallet/summary` | User name and balance | `200 { user: { id, fullName }, balance: Money }` |
| `GET /api/v1/wallet/movements?cursor=&limit=10` | Movements, newest first | `200 { items: Movement[], nextCursor: string \| null }` |
| `GET /api/v1/contacts` | The user's favorites | `200 { items: ContactView[] }` |
| `POST /api/v1/contacts` | Creates a contact | `201 ContactView` |
| `POST /api/v1/transfers` | Creates a transfer; `Idempotency-Key` header required | `201 TransferView` |
| `GET /api/v1/transfers/{transferId}` | Receipt | `200 TransferView` |
| `GET /api/v1/transfers?idempotencyKey=` | Status lookup after a timeout | `200 TransferView` or `404` |

Login, registration and logout are not REST endpoints: they are Server Actions in `src/features/auth/actions.ts`, because they mutate cookies and live next to the form that uses them.

Error envelope, identical on every endpoint:

```ts
interface ApiErrorBody {
  error: {
    code: ApiErrorCode; message: string; requestId: string;
    details?: Record<string, string[]>; balance?: Money;
  };
}
type ApiErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INSUFFICIENT_FUNDS"
  | "IDEMPOTENCY_CONFLICT" | "UPSTREAM_UNAVAILABLE" | "INTERNAL_ERROR";
```

`message` is an i18n key, not final text. The UI translates it. `balance` is present only on `INSUFFICIENT_FUNDS`, so the client reads the current balance as `Money` instead of parsing it out of a string. `FORBIDDEN` answers a CSRF check failure (SPEC 04): `403` for a bad `Origin`, `415` for a wrong `Content-Type`. Every response from `/api/v1/*`, success or error, carries `Cache-Control: no-store` — balances and receipts must never be served from a shared cache.

| `ApiErrorCode` | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Invalid input; `details` lists the field codes |
| `UNAUTHORIZED` | 401 | Missing or expired session |
| `FORBIDDEN` | 403 / 415 | CSRF check failed (bad `Origin` or wrong `Content-Type`) |
| `NOT_FOUND` | 404 | Resource does not exist for this user |
| `INSUFFICIENT_FUNDS` | 422 | Real or simulated lack of balance; `balance` carries the current amount |
| `IDEMPOTENCY_CONFLICT` | 409 | Same `Idempotency-Key`, different payload |
| `UPSTREAM_UNAVAILABLE` | 503 | Simulated network failure or forced read error |
| `INTERNAL_ERROR` | 500 | Unexpected server error or simulated unknown failure |

Pagination: the cursor is opaque (base64url of `createdAt|id`). Ordering stays stable even if new movements are inserted while the user paginates.

## 9. Confirmation scenarios

`POST /api/v1/transfers` picks the scenario with `pickScenario(random)` in `src/server/mock/scenarios.ts`. The function receives the random generator as an injected dependency so it can be tested.

| Scenario | Weight | Server behavior | Client behavior |
| --- | --- | --- | --- |
| `success` | 60 | Validates, debits and responds `201` after 600–1200 ms | Navigates to `/transfers/{id}` (receipt) |
| `network_error` | 10 | Responds `503 UPSTREAM_UNAVAILABLE` without debiting | "Se perdió la conexión" screen with retry using the same `Idempotency-Key` |
| `insufficient_funds` | 10 | Responds `422 INSUFFICIENT_FUNDS` with the current balance in `details` | Descriptive error with the current balance and a "Cambiar monto" action |
| `timeout` | 10 | Waits 12 s, then debits and responds `201` | Aborts at 8 s (`AbortController`) and shows "Está tardando más de lo normal" with "Revisar estado del envío" |
| `unknown_error` | 10 | Responds `500 INTERNAL_ERROR` without debiting | Generic fallback with the `requestId` reference |

Also, a `fetch` that throws `TypeError` (no real connection) lands on the same UI as `network_error`.

Deterministic override:

- The `mock_scenario` cookie forces a scenario. It is only honored when `MOCK_ALLOW_SCENARIO_OVERRIDE=true`.
- The `mock_read_scenario` cookie (`ok`, `error`, `slow`) does the same for the read endpoints (`wallet/summary`, `wallet/movements`, `contacts`), so the Home loading and error states can be shown on demand. Reads without it respond after 300–800 ms.
  - `ok`: wait 300–800 ms, then respond normally.
  - `slow`: wait 3000 ms, then respond normally — long enough to see the loading skeleton.
  - `error`: wait 300–800 ms, then `503 UPSTREAM_UNAVAILABLE` — makes the "Reintentar" button meaningful.
  - An unknown cookie value is ignored and falls back to the random pick (transfer) or `ok` (read) instead of breaking the endpoint.
- The DEV panel writes it. The panel only renders with `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`.
- Playwright writes the cookie directly so every E2E is deterministic.

Idempotency:

- The client generates the `Idempotency-Key` (UUID v4) when entering `/transfers/new/review` and keeps it in the draft.
- The server stores `key → transferId` only when the transfer completes.
- Same key with the same payload returns the existing transfer (`201`, no double charge).
- Same key with a different payload returns `409 IDEMPOTENCY_CONFLICT`.
- Failed attempts are not stored, so the retry can complete.

`POST /api/v1/transfers` runs its checks in this fixed order (SPEC 04): CSRF and content type → session → input validation (`Idempotency-Key` format, then payload schema) → idempotency replay (`findByIdempotencyKey`) → scenario pick and the behavior above. When the key already has a completed transfer, the handler skips the random scenario and latency entirely and calls `TransferService.create` directly: its own payload-hash check then decides the outcome, returning the stored transfer (`201`, matching payload) or `409 IDEMPOTENCY_CONFLICT` (different payload) with no further debit either way. Invalid input always gets a real `400` before any scenario applies, and a retry after a `timeout` never lands on a fake failure because the replay check runs before the random pick.

## 10. Simulated persistence

- A JSON file at `MOCK_DB_PATH` (default `.data/db.json`, git-ignored).
- Schema `{ schemaVersion: 1, users, wallets, movements, contacts, transfers, idempotencyKeys }`.
- If the file does not exist, it is created from `src/server/db/seed.ts`. If `schemaVersion` does not match, it is regenerated from the seed.
- Writes go through an in-memory queue (mutex) and are atomic: temporary file, then `rename`. A transfer reads the balance, validates, debits, inserts the movement and stores the key inside the same critical section. When the recipient is a phone that belongs to a registered user, that user's wallet is credited and a `transfer_in` movement is inserted in the same critical section; CLABE and card recipients are external and only debit the sender.
- On Vercel the filesystem is ephemeral: `MOCK_DB_PATH` points to `/tmp`. Records persist while the instance lives. This is documented as a known limitation.

Seed users:

| Name | Mobile | Email | Password | Purpose |
| --- | --- | --- | --- | --- |
| Mariana López | 5512345678 | mariana@spin.test | `Spin2026` | Balance $12,450.80, 25 movements (pagination), 3 favorites |
| Diego Ramírez | 5587654321 | diego@spin.test | `Spin2026` | Balance $500.00, no movements (empty state) |

## 11. Session and security

Session:

- The `smw_session` cookie holds `base64url(payload).signature`. The payload is `{ userId, issuedAt, expiresAt }` and the signature is HMAC-SHA256 with `SESSION_SECRET`.
- Attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, absolute expiry of 30 minutes.
- `proxy.ts` verifies signature and expiry: redirects `/home` and `/transfers/*` to `/login` without a session, and `/login` and `/register` to `/home` with one. `/` redirects to `/login` or `/home`. An invalid or expired cookie counts as no session.
- `proxy.ts` never redirects `/api/**`: Route Handlers answer `401` JSON themselves, and an API client must never receive a redirect to an HTML page.
- Defense in depth (doc `proxy.md` and the data security guide): every Server Action and every Route Handler re-checks the session with `requireSession()`. The proxy is not the only barrier.

Credentials:

- Passwords hashed with `scrypt` from `node:crypto` and a random per-user salt. Comparison uses `timingSafeEqual`.
- A failed login names the method in use ("El celular o la contraseña no coinciden" / "El email o la contraseña no coinciden") but never reveals whether the user exists.
- In-memory rate limit, per instance: 5 failed attempts per identifier inside a fixed 15-minute window that starts at the first failure. The key is the method plus the normalized identifier, so formatting variants of one phone share a counter. Once blocked, every attempt is rejected with a wait message until the window ends, even one with the right password. A successful login resets the counter. The limiter runs after schema validation and before `scrypt`.

Web surface:

- Mutating Route Handlers require `Content-Type: application/json` and an `Origin` equal to the host (CSRF). Server Actions already include Next's origin check.
- Global headers in `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy` and `Strict-Transport-Security` in production.
- Environment variables are validated with Zod at startup (`src/shared/config/env.ts`). Modules in `server/` import `server-only`.
- Logs never contain passwords or full account numbers; the logger redacts `password`, `phone`, `email`, `clabe` and `cardNumber`.

## 12. Error handling and traceability

- **Correlation:** `proxy.ts` generates `x-request-id` (`crypto.randomUUID()`), injects it into the request headers and returns it in the response. Route Handlers, services and logs use it. Error screens show it as "Referencia".
- **Logger:** `src/shared/observability/logger.ts` writes structured JSON (`level`, `message`, `requestId`, `context`) with PII redaction.
- **Reporter:** the `ErrorReporter { captureException(error, context) }` interface has `ConsoleErrorReporter` as the default implementation. Connecting Sentry means writing another adapter, without touching call sites.
- **Server:** `instrumentation.ts` implements `onRequestError` and sends every unhandled error to the reporter.
- **Browser:** `instrumentation-client.ts` listens to `error` and `unhandledrejection`. Per-segment `error.tsx` and `global-error.tsx` report and render a recoverable UI.
- **Typed client errors:** `apiClient` turns every failure into the union `ApiFailure = ApiError | NetworkError | TimeoutError | UnknownError`. The UI runs an exhaustive `switch` on `kind`, and TypeScript fails if a case is missing.
- **Isolation:** each Home block has its own `<Suspense>` and error boundary. If movements fail, the balance stays visible.

## 13. Scalability and maintainability

- **Stateless server:** the session lives in a signed cookie, so any instance serves any request. The local JSON is the only stateful piece and is isolated behind repositories: replacing it with a real API touches neither services nor UI.
- **Cursor pagination:** constant cost per page and no duplicates or gaps when movements are inserted.
- **Less JavaScript:** Server Components by default. Client JS is limited to forms, the wizard and pagination, and each route gets its own chunk.
- **Client cache:** TanStack Query with per-resource `staleTime`. After a successful transfer only `wallet.summary` and `wallet.movements` are invalidated.
- **Versioning:** the API lives under `/api/v1` so it can evolve without breaking clients.
- **Idempotency:** network and user retries never duplicate charges.
- **Boundaries:** ESLint rules prevent coupling between features and keep the domain framework-free.

## 14. Styling and design system

Approved tokens (extracted from spinbyoxxo.com.mx):

| CSS token | Value | Usage |
| --- | --- | --- |
| `--color-white` | `#FFFFFF` | Text and logos on purple surfaces |
| `--color-brand-purple` | `#531BC8` | Headers, focus, navigation |
| `--color-brand-purple-2` | `#7549D3` | Gradient end |
| `--color-brand-orange` | `#FF6600` | Main CTA, one per screen |
| `--color-brand-orange-hover` | `#FF8533` | CTA hover |
| `--color-lavender-100/200/300/500` | `#F6F4FB` / `#EEE8FA` / `#DDD1F4` / `#BAA4E9` | Backgrounds, borders, focus |
| `--color-ink-900/700/500/300` | `#2A2338` / `#3F3F3F` / `#6E6880` / `#C8C4D2` | Text and disabled |
| `--color-success` / `-bg` | `#12805C` / `#E3F5EE` | Credits, success |
| `--color-danger` / `-bg` | `#C62828` / `#FDECEC` | Errors |
| `--color-warning` / `-bg` | `#A15C00` / `#FFF3DF` | Timeout |
| `--color-info` / `-bg` | `#3D1199` / `#EEE8FA` | Info alerts (processing) |
| `--color-success-strong` | `#0E6B4C` | Text on `success-bg` (5.8:1); `success` stays for amounts on white |
| `--color-on-brand-orange` | `var(--color-ink-900)` | Label on the orange CTA (option A, 5.1:1). White on orange fails AA and is not used |
| `--radius-s/m/l/xl/pill` | `10px` / `16px` / `24px` / `28px` / `999px` | Inputs, cards, purple headers, buttons |
| `--radius-icon` | `12px` | Icon tiles (brand panel perks, movement icons) |

Scale tokens (SPEC 05). Spacing follows the same 4 px grid as Tailwind's spacing utilities, so page layout and components share one scale. Dimensions and type sizes keep the design's exact values:

| CSS token | Value | Usage |
| --- | --- | --- |
| `--space-1/2/3/4/5/6/8/10/12/14` | `4px` / `8px` / `12px` / `16px` / `20px` / `24px` / `32px` / `40px` / `48px` / `56px` | Padding, gaps and margins |
| `--text-size-xs/sm/md/lg/xl` | `12px` / `13px` / `14px` / `15px` / `21px` | Hints and errors, labels and alerts, prefixes, body and buttons, mobile auth titles |
| `--text-size-input` | `16px` | Text inside inputs; below 16 px iOS Safari zooms on focus |
| `--text-size-lead` / `-2xl` / `-3xl` / `-hero` | `17px` / `28px` / `32px` / `44px` | Desktop lead text, desktop page H1, desktop auth title, brand panel headline |
| `--size-control` | `50px` | Input height, and the minimum button height on mobile |
| `--size-touch` | `44px` | Minimum touch target (segmented options, back link, eye toggle) |
| `--size-button-desktop` / `--size-button-min-width` | `48px` / `200px` | Button height from `lg`, and the minimum width of a non-block button from `lg` |
| `--size-icon-tile` / `--size-logo-md` / `--size-logo-lg` | `36px` / `84px` / `104px` | Brand panel perk tiles, the mobile logo and the desktop logo |
| `--size-icon-sm/md` | `16px` / `18px` | Spinner and inline icons, alert and field icons |
| `--size-icon-button` | `32px` | Round icon-only buttons (app bar back link) |
| `--border-width-thin` / `--border-width` | `1.5px` / `2px` | Field control border, secondary button and spinner |
| `--focus-ring-width` / `--focus-ring-offset` / `--focus-halo` | `3px` / `2px` / `4px` | Focus outline and the field's focus and error halo |
| `--duration-fast` / `--duration-spin` | `150ms` / `1s` | Hover and focus transitions, one spinner turn |
| `--container-auth` | `420px` | Max width of the public card at `md`; Tailwind `max-w-auth` |
| `--container-form` | `400px` | Max width of the auth form at `lg`; Tailwind `max-w-form` |

- Typography: Montserrat (400–900) for headings and amounts, Open Sans (400–700) for body, both through `next/font/google`. Amounts use `tabular-nums`.
- Tokens live as CSS variables in `src/app/globals.css` and are exposed to Tailwind with `@theme`.
- Every custom component has `name.module.scss` with BEM (`.button`, `.button__spinner`, `.button--primary`) and consumes only CSS variables. No loose measured values: padding, gaps, sizes, borders, type sizes and durations come from the scale tokens above. A value no token describes is allowed only for a percentage or ratio, a `1px` hairline, `999px`, and decorative geometry used once (the brand panel's orange ring), which is declared as a named custom property at the top of its block.
- A component's closed-set constants (`BUTTON_VARIANT`, `ICON_NAME`, …) and their unions live in a `types.ts` next to it; its `XProps` interface stays in the component file.
- Tailwind only handles page layout: flex, grid, gap, padding and breakpoints.
- Mobile-first. Breakpoints `md` 768 px, `lg` 1024 px and, from SPEC 06, `xl` 1280 px (approved desktop proposal, 2026-10-22). Below `md` one column with a top bar; at `md` one centered column, with login in a rounded card; from `lg` login and registration become a 50/50 split with a brand panel, and the private layout gets a 72 px icon rail, content and a 320 px aside; from `xl` a 240 px labeled sidebar, content capped at 1040 px and a 340 px sticky aside. The private-layout tokens (`--container-content`, aside, rail and sidebar widths) are added by SPEC 06.
- Buttons: 50 px tall and full width on mobile; from `lg`, 48 px tall with auto width (min 200 px), full width only inside forms up to 400 px or cards up to 340 px.
- On mobile the main CTA of a form sits in a bottom action bar with `env(safe-area-inset-bottom)`, and the root `viewport` sets `interactiveWidget: "resizes-content"` so the keyboard never covers it.
- Light theme only.
- Accessibility: AA contrast (links are purple and underlined, never orange), visible focus, touch targets of at least 44 × 44 px, `aria-describedby` on field errors, `role="alert"` on server errors, no text under 12 px and respect for `prefers-reduced-motion`.
- Logo: `public/assets/shared/spin-oxxo-logo.svg`.

## 15. Testing strategy

| Level | Tool | What it covers |
| --- | --- | --- |
| Domain unit | Vitest | Rules, validators (CLABE, Luhn, mobile, email), money, cursor, `pickScenario` with an injected generator |
| Server unit | Vitest with a temporary JSON file | Services, session (signature, expiry, tampering), hashing, idempotency, write lock |
| Hooks | Vitest + Testing Library + MSW | `useWalletSummary`, `useMovements` (infinite), `useCreateTransfer` (all five outcomes) |
| Critical components | Testing Library | Forms with validation, list states, outcome screens |
| E2E | Playwright (`mobile` Pixel 7 and `desktop` Chrome projects) | Login, registration, Home, wizard and the five scenarios forced via cookie |

- Vitest does not support `async` Server Components (doc `testing/vitest.md`); those are covered by E2E.
- MSW runs with `onUnhandledRequest: "error"` so no test hits the real network.
- 80 % coverage threshold on `src/domain`, `src/server` and `src/shared/lib`.
- E2E runs its own server on port 3100 with `MOCK_DB_PATH=.data/e2e-db.json`, set explicitly in `playwright.config.ts` and never read from the parent environment. `e2e/global-setup.ts` deletes that file before each run, so the seed is regenerated and `.data/db.json` is never touched.

## 16. Quality, CI and delivery

- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:coverage`, `test:e2e`.
- `.github/workflows/ci.yml` runs on push to `develop` and `feature/**` and on PRs to `develop`: `npm ci`, lint, typecheck, tests with coverage, build and E2E. Uploads the Playwright report as an artifact.
- Branches: `main` (merged by the user), `develop` (integration) and `feature/NN-slug` per milestone, branched from `develop` and merged back through a PR. Commits follow Conventional Commits.
- Vercel deploy with `SESSION_SECRET`, `MOCK_DB_PATH=/tmp/spin-mini-wallet/db.json`, `MOCK_ALLOW_SCENARIO_OVERRIDE=true` and `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`. The override and the panel stay on deliberately for the evaluator's demo.

## 17. PDF requirements traceability

| PDF requirement | Where it is addressed | Milestone |
| --- | --- | --- |
| Login with phone or email | Mobile/email toggle, shared schema | 02, 05 |
| Format and required-field validation | Domain validators + Zod on client and Server Action | 02, 05 |
| Loading and simulated error states on login | Button loading state + server error | 05 |
| Simple mocked session persistence | Signed `smw_session` cookie | 03, 05 |
| Navigate to Home after login | Redirect in the Server Action | 05 |
| Home: mocked balance and name | `GET /wallet/summary` + SSR | 04, 06 |
| Home: recent movements | `GET /wallet/movements` with cursor | 04, 06 |
| Home: loading, empty and error states | Suspense + skeleton, Diego user, per-block error boundary, `mock_read_scenario` | 04, 06 |
| Home: new transaction button | "Enviar dinero" CTA | 06 |
| Enter amount | `amount` step | 07 |
| Pick a favorite or create a contact (mock) and save it | `recipient` step + `POST /contacts` | 04, 07 |
| Summary before confirming | `review` step | 07 |
| Confirmation with mocked response | `POST /transfers` | 04, 08 |
| Receipt or success | `/transfers/[transferId]` | 08 |
| Rules: amount > 0, sufficient balance, recipient | `domain/transfer/rules.ts` in client, handler and service | 02, 03, 04, 07 |
| Random confirmation: 5 scenarios | Scenario engine + per-outcome UI | 04, 08 |
| Justified SSR/CSR | Section 4 of this spec + `DECISIONS.md` | 09 |
| Justified state management | Section 3 + `DECISIONS.md` | 08 |
| API Routes with mocked data | `src/app/api/v1/*` | 04 |
| Unit tests for validations, hooks and components | Vitest + MSW | 01–07 |
| Justified E2E | Playwright | 01, 05, 08 |
| README, DECISIONS, AI_USAGE, time spent | Final documentation | 08 |

## 18. Decisions

- **Yes:** App Router with `(public)` and `(private)` route groups. Layouts separate the authenticated shell without affecting URLs.
- **No:** Pages Router. It does not use Server Components, streaming or Server Actions, which the PDF values.
- **Yes:** Server Actions for auth and Route Handlers for data. Both are shown, each where it fits.
- **No:** Server Components calling their own API over HTTP. It adds latency and another failure point with no benefit.
- **Yes:** TanStack Query + Zustand. They separate server state from UI state.
- **No:** Redux Toolkit. Too much boilerplate for this scope.
- **No:** Context alone. It forces reimplementing caching, retries and pagination.
- **Yes:** signed httpOnly cookie + `proxy.ts` + `requireSession()` in every handler. Enables Home SSR and keeps the token away from XSS.
- **No:** `localStorage` for the session. It forces CSR, flashes protected content and exposes the token to scripts.
- **Yes:** integer cents with a branded type. Avoids floating-point rounding errors.
- **Yes:** one rules function used in client, handler and service. One implementation, three enforcement points.
- **Yes:** JSON file only for persistence (user decision). Meets "save to file" simply; the lack of durability on Vercel is documented.
- **No:** in-memory adapter as a fallback. Discarded by the user.
- **Yes:** timeout treated as an unknown state with a lookup by `Idempotency-Key`. With money, retrying blindly can duplicate a charge.
- **Yes:** weighted scenarios with a cookie override. The demo is random as the PDF asks, and tests are deterministic.
- **Yes:** Vitest. Faster and less configuration than Jest for ESM and TypeScript.
- **Yes:** Playwright. Tests mobile and desktop in one run and is the runner documented by Next 16.
- **No:** Cypress. Slower, with limited multi-browser support.
- **Yes:** next-intl with a fixed es-MX locale and no URL prefix. Meets the request to keep every text in files without complicating routing.
- **Yes:** SCSS Modules with BEM for components and Tailwind for layout (user decision).
- **No:** shadcn/ui or component libraries. Custom composition is part of what is evaluated.
- **No:** Husky, lint-staged, commitlint or Prettier. Not chosen during planning; CI covers quality.

## 19. Risks

| Risk | Mitigation |
| --- | --- |
| Concurrent writes corrupt the JSON | In-memory mutex + atomic write (temporary file + `rename`) |
| Ephemeral filesystem on Vercel | `MOCK_DB_PATH` in `/tmp`; limitation in the README; seed users always exist |
| The serverless function ends before the 12 s `timeout` | The scenario is demonstrated locally and in E2E; documented for Vercel |
| Reading cookies outside `<Suspense>` breaks prerendering with Cache Components | Mandatory pattern in section 4; the build fails if violated, and CI catches it |
| DEV panel and override active in the deploy | On deliberately for the evaluator; controlled by environment variables and documented |
| Next 16.4 differs from the agent's prior knowledge | Check `node_modules/next/dist/docs/` before each milestone |

## What is **not** in this spec

- Real authentication, OTP, MFA and password recovery.
- Dark mode and languages other than es-MX.
- A real database and durable persistence on Vercel.
- Real Sentry integration.
- Additional transaction limits, fees, and editing or deleting contacts.
- Husky, lint-staged, commitlint and Prettier.

If any of them lands, it goes in its own spec.
