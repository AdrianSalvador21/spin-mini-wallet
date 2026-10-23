# Design decisions

The decisions behind the Spin Mini Wallet. Each item says what was chosen and why, and links to a diagram or a spec when there is more to say. The full record, including the options that were discarded, lives in [`specs/`](./specs/README.md).

## Contents

1. [Project structure](#1-project-structure)
2. [Separating UI from business logic](#2-separating-ui-from-business-logic)
3. [Rendering per route](#3-rendering-per-route)
4. [State management](#4-state-management)
5. [Services: Route Handlers and Server Actions](#5-services-route-handlers-and-server-actions)
6. [Money, idempotency and the timeout](#6-money-idempotency-and-the-timeout)
7. [Error handling and traceability](#7-error-handling-and-traceability)
8. [Testing](#8-testing)
9. [Security baseline](#9-security-baseline)
10. [Styling and i18n](#10-styling-and-i18n)
11. [Edge cases considered](#11-edge-cases-considered)
12. [Brand improvements in the flow](#12-brand-improvements-in-the-flow)
13. [Known trade-offs](#13-known-trade-offs)
14. [What I would do with more time](#14-what-i-would-do-with-more-time)

## 1. Project structure

- **Four layers with enforced boundaries:** `domain` (pure TypeScript), `server` (services and storage), `features` (UI per feature) and `shared` (primitives and utilities), composed by `app` (routes only). ESLint's `no-restricted-imports` makes a wrong import a build error, not a code-review comment. → [Architecture](./docs/architecture.md#layers)
- **Feature folders, not type folders.** `features/transfers` holds its components, hooks, store and API calls together; features never import each other, so one can be removed or rewritten alone.
- **One folder per component** (`.tsx`, `.test.tsx`, `.module.scss`, `types.ts`), so a component and its test and styles move together.
- **Spec-driven milestones.** The work was split into nine milestones (`specs/01` to `09`), each planned, approved and implemented step by step. → [`specs/README.md`](./specs/README.md)

## 2. Separating UI from business logic

- **The three PDF rules live once**, in `src/domain/transfer/rules.ts` (`validateTransfer`), and run in three places:
  1. the wizard, for instant feedback;
  2. the `POST /api/v1/transfers` handler, before the simulated scenario, so invalid input gets a real `400`/`404`/`422`;
  3. `TransferService`, inside the write lock, which is the check that decides.

  Client validation is UX; it never authorizes anything.
- **The domain returns codes, never text.** Validators return `Result<T, ValidationCode>`; the UI translates codes through `src/messages/es-MX/errors.json`, and a test fails the build if a code has no message.
- **Zod schemas wrap the domain validators**, so the same schema validates the form on the client and the payload on the server.
- **Components render, hooks decide.** For example, `useTransferSubmission` owns the submission state machine and the outcome mapping is a pure function (`toTransferOutcome`); the outcome screens only switch on a discriminated union.

## 3. Rendering per route

| Route | Rendering | Why |
| --- | --- | --- |
| `/login`, `/register` | Static shell + client form + Server Action | No data to fetch; the submit sets a cookie and redirects on the server |
| `/home` | Static shell + two dynamic sections streamed in `<Suspense>`; "Ver más" on the client | The balance arrives server-rendered with no initial spinner; each block fails on its own |
| `/transfers/new/*` | Client wizard in a static shell | Highly interactive; reads the balance already cached by Home |
| `/transfers/[transferId]` | Dynamic SSR in `<Suspense>` | A receipt must be reloadable and shareable as a page |

Next.js 16 Cache Components is on: everything is dynamic unless cached explicitly, and per-user data is never cached. Server Components call the services directly instead of their own API. → [Data flows](./docs/flows.md#home)

## 4. State management

- **TanStack Query for server state** (balance, movements, contacts): caching, deduplication, retries, infinite pagination, invalidation after a transfer and SSR hydration, with no custom code.
- **Zustand for the little client-only state:** the transfer draft (persisted to `sessionStorage`, masked data only), the submission state, and a non-persisted live preview.
- **The URL and cookies for preferences:** the movements filter is `?direction=`, and "hide balance" is a cookie the server reads, so the first paint is already correct.
- **Discarded:** Redux Toolkit (boilerplate for this scope) and Context alone (it would mean rebuilding caching, retries and pagination). → [State](./docs/state.md)

## 5. Services: Route Handlers and Server Actions

- **Route Handlers under `/api/v1`** for data the client reads and writes (wallet, movements, contacts, transfers), with one JSON error envelope and versioning in the path.
- **Server Actions for auth** (login, register, logout), because they set cookies and redirect, and they live next to the form.
- **Handlers are factories with injected dependencies** (`createXHandler(deps)`), so tests pass a fake clock, randomness and logger instead of mocking modules.
- **Storage behind repositories:** services only see `Database` and `Repositories`; the JSON file could be replaced by a real database without touching services or UI.

## 6. Money, idempotency and the timeout

- **Integer cents with a branded `Cents` type.** No floats anywhere; the server rejects a fractional or oversized amount with a code.
- **Idempotency key per transfer attempt.** The client creates a UUID on the review step and sends it as `Idempotency-Key`; the server stores it only when the transfer completes. A retry with the same key and payload returns the same transfer; with a different payload, `409`.
- **A timeout is "unknown", not "failed".** The client aborts at 8 s, but the simulated server finishes at 12 s. The app offers "Revisar estado del envío" (a lookup by key) instead of a blind retry, and a retry is safe anyway because of the key. → [Timeout sequence](./docs/flows.md#timeout-and-status-lookup)
- **Random outcomes, deterministic tests.** The confirmation draws 60/10/10/10/10 with an injected `random`; a cookie (`mock_scenario`) forces an outcome for E2E and for the DEV panel.

## 7. Error handling and traceability

- **Typed client failures:** `ApiFailure = api | network | timeout | unknown`, handled with exhaustive `switch`es, so a new kind is a TypeScript error until every screen handles it.
- **A request id end to end:** the client sends one per attempt, the proxy keeps a valid one, every response echoes it, the server logs one `api_request` line with it, and every error screen shows it as "Referencia" with a "Copiar" button.
- **Structured logs with PII redaction** and an `ErrorReporter` interface (console by default; Sentry would be one adapter).
- **Isolation:** each Home block has its own error boundary, so a movements failure keeps the balance visible.

## 8. Testing

- **Vitest + Testing Library + MSW** for the domain (100 % coverage gate), the server (services against a temporary JSON file, handlers with injected dependencies), hooks and critical components. MSW fails any test that hits an unmocked request.
- **Playwright** on two projects (Pixel 7 and desktop Chrome) against its own server and database: login, registration, Home states, the wizard, all five outcomes and the timeout lookup, forced by cookie. Chosen over Cypress for mobile emulation and multi-project runs in one command.
- **CI** (GitHub Actions) runs lint, typecheck, unit tests with coverage, build and E2E on every push to `develop` and `feature/**` and on every pull request to `develop`.

## 9. Security baseline

The PDF does not ask for real security, so this is the minimum expected from production-quality code, not extra scope:

- an HMAC-signed, `httpOnly`, `SameSite=Lax` session cookie with a 30-minute expiry, checked in the proxy and again in every handler and action;
- passwords hashed with `scrypt`, compared in constant time, and a login error that never reveals whether the user exists;
- a login rate limit (5 failures per 15 minutes per identifier);
- CSRF checks (`Origin` and `Content-Type`) on mutating endpoints;
- security headers, environment validation at startup, and masked accounts in every response and log.

## 10. Styling and i18n

- **Tailwind only for page layout; SCSS Modules with BEM for components**, reading the same CSS variables. Every size and color comes from a token, so the design system lives in one file (`src/app/globals.css`).
- **Brand from Spin's own site:** the purple, the orange and the fonts were taken from spinbyoxxo.com.mx. Orange marks the one main action per screen.
- **next-intl with a fixed `es-MX` locale:** every user-facing string is in `src/messages/es-MX/*.json`, typed, so a missing key is a compile error.
- **Accessibility built in:** 44 px touch targets, visible focus, `aria-describedby` on field errors, `role="alert"` on errors, `prefers-reduced-motion`, and color never as the only signal (credits are green and carry a `+`).

## 11. Edge cases considered

- **Double click on "Confirmar envío":** the submission ignores a second call while processing; one request is sent.
- **Reload in the middle of the wizard:** the draft is restored from `sessionStorage`; the step guard sends the user to the first incomplete step.
- **Reload while an outcome is shown:** the review comes back with the same idempotency key, so a retry stays safe.
- **Retry after a timeout:** the replay check returns the transfer that completed meanwhile; the money moves once.
- **Session expired mid-flow:** any `401` clears the client session and goes to the login.
- **Another account in the same tab:** the draft is tied to its owner and discarded for a different user.
- **Sending to one's own phone:** rejected with `RECIPIENT_IS_SELF`, both when saving the contact and when sending.
- **Saving a contact that already exists:** the server returns the existing one (`200`) and can upgrade it to a favorite, never downgrade it.
- **Fractional or oversized amounts sent directly to the API:** rejected with `AMOUNT_INVALID_FORMAT` or `AMOUNT_EXCEEDS_MAXIMUM`.
- **The balance changed between the review and the confirmation:** the server re-checks inside the lock and answers `422` with the current balance. The simulated `insufficient_funds` outcome represents exactly this race, which is why it can appear even when the balance shown earlier was enough.
- **Partial Home failure:** the movements fail with "Reintentar" while the balance stays visible.
- **A session whose user no longer exists** (another Vercel instance): the cookie is cleared through `/session/end` and the user lands on the login, not on an error.
- **Concurrent transfers:** a process-wide lock serializes writes; a test sends 10 concurrent $2,000 transfers on a $10,000 balance and exactly 5 succeed.

## 12. Brand improvements in the flow

After the confirmation milestone, a third design pass carried Spin's identity through the whole flow instead of only the login: Home with a light header and a branded balance card (proposal B; proposal A was discarded), the rings texture on the login, the side navigation and the receipt, a branded "processing" orbit, a ticket-style receipt, and "Cancelar envío" as an X button. They are built from shared primitives (`BrandRings`, `BrandLogo` with a color and a white variant) and design tokens. The orbit keeps turning slowly under `prefers-reduced-motion` instead of stopping, because a frozen indicator while money is moving reads as a hung app; it is the one documented exception to the reduced-motion rule. → [`specs/challenge.md` §8.5](./specs/challenge.md)

## 13. Known trade-offs

- **White on orange:** the main button uses Spin's white-on-orange (2.9:1), below AA for normal text. Chosen to match the brand; the label is bold and 15–16 px.
- **Simulated latency on Home's server render:** the reads wait 300–800 ms (3 s in the `slow` scenario) so loading states and streaming are visible in the demo.
- **The DEV panel and the scenario override are on in the deploy**, on purpose, so the reviewer can force every outcome. Both are controlled by environment variables.
- **A JSON file as the database:** simple and enough for the challenge, but on Vercel each instance has its own copy in `/tmp` and it resets when the instance stops. See the README's limitations.
- **The login rate limit is in memory**, so it is per instance.

## 14. What I would do with more time

- A real database (Postgres) behind the existing repositories, and a shared store for the rate limit.
- Tests for the remaining hooks (`use-wallet-summary`, `use-movements`, `use-share-receipt`, `use-transfer-balance`) and the contact list component.
- An automated accessibility audit (axe) in the E2E suite.
- Recent recipients and search in the recipient step (cut to fit the deadline).
- A real error reporter (Sentry) through the existing `ErrorReporter` interface, and an OpenAPI description of `/api/v1`.
- Real authentication features: OTP, password recovery, device binding.
