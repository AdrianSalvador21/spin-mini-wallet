# Roadmap — Spin Mini Wallet

> **Status:** Approved
> **Depends on:** SPEC 00
> **Date:** 2026-10-21
> **Objective:** List the project's 9 milestones, their order, branch and spec, so it is always clear which one is next to write and implement.

## How to use it

- The original brief and the approved design live in [`challenge.md`](./challenge.md) and [`design/mini-wallet-design.html`](./design/mini-wallet-design.html). Every spec is written against them.
- The global contract lives in [`00-architecture.md`](./00-architecture.md). No milestone contradicts it; if something changes, SPEC 00 is updated first.
- Each milestone has its own spec (`NN-slug.md`). The spec is written with `/spec` when the milestone starts, using what was learned in the previous ones.
- Each milestone is implemented on `feature/NN-slug`, branched from `develop` and merged back through a PR to `develop`. The user merges `develop` into `main`.
- A milestone is done when its spec moves to `Implemented` and its PR is merged. Only then is the next one written.

## Status

| # | Milestone | Spec | Branch | Status |
| --- | --- | --- | --- | --- |
| 00 | Architecture and global contracts | [00-architecture.md](./00-architecture.md) | — | Approved |
| 01 | Scaffolding, tooling and visual foundations | [01-scaffolding.md](./01-scaffolding.md) | `feature/01-scaffolding` | Implemented |
| 02 | Domain layer | [02-domain.md](./02-domain.md) | `feature/02-domain` | Implemented |
| 03 | Simulated backend core | [03-mock-backend.md](./03-mock-backend.md) | `feature/03-mock-backend` | Implemented |
| 04 | HTTP API and observability | [04-api.md](./04-api.md) | `feature/04-api` | Implemented |
| 05 | Authentication | [05-auth.md](./05-auth.md) | `feature/05-auth` | In progress |
| 06 | Home | To be written | `feature/06-home` | Pending |
| 07 | New transfer flow | To be written | `feature/07-transfer-flow` | Pending |
| 08 | Confirmation and receipt | To be written | `feature/08-confirmation-receipt` | Pending |
| 09 | Final quality, deploy and documentation | To be written | `feature/09-delivery` | Pending |

**In progress:** 05 — Authentication. **Next spec to write:** 06 — Home, once 05 is merged.

The original milestone 02 ("Domain and simulated backend") was split on 2026-10-21 because it touched more than three areas. Session primitives moved from the authentication milestone into the simulated backend so every `/api/v1/*` route is protected from the start.

Milestone 03 ("Simulated backend") was split again on 2026-10-21, for the same reason: it touched persistence, session, HTTP API, scenarios and observability. 03 keeps the server core with no HTTP exposed; 04 adds the `/api/v1/*` Route Handlers, the error envelope, CSRF, the scenario engine and observability. Every milestone after it shifts by one.

## Milestones

### 01 — Scaffolding, tooling and visual foundations

Repo base: branches, Node 24, `src/`, Sass and Spin tokens, fonts, next-intl, ESLint boundary rules, Vitest + MSW, Playwright and CI. Delivers a branded page that proves everything fits together. See [01-scaffolding.md](./01-scaffolding.md).

### 02 — Domain layer

- Shared primitives (`Brand`, `Result`, validation codes) and money in integer cents with a safe parser.
- Entity types with branded IDs.
- Validators: mobile (normalized), email, password, full name, CLABE with check digit and bank detection, card with Luhn, concept.
- The three business rules in `validateTransfer` and the Zod schemas built on the validators.
- An es-MX message for every validation code and a 100 % coverage gate on `src/domain/**`.
- Covers: "business rules not only in the UI" and the validation part of PDF screens 1 and 3. See [02-domain.md](./02-domain.md).

### 03 — Simulated backend core

- Environment validation, JSON database with mutex and atomic writes, seed (Mariana and Diego), repositories and services.
- Session primitives: signed `smw_session` cookie, `requireSession()` and scrypt password hashing.
- `AuthService`, `WalletService`, `ContactService` and `TransferService`, with idempotency and an internal P2P credit when the recipient phone belongs to a registered user, all inside one critical section.
- No HTTP endpoint yet: Server Components and Route Handlers will call these services directly.
- Covers: the server side of every PDF screen, with no HTTP exposed yet. See [03-mock-backend.md](./03-mock-backend.md).

### 04 — HTTP API and observability

- `/api/v1/*` Route Handlers on top of the 03 services, with the error envelope and CSRF checks.
- Transfer scenario engine (`mock_scenario`) and read scenarios (`mock_read_scenario`: `ok`, `error`, `slow`), both honored only with the override enabled.
- `proxy.ts` with `x-request-id`, logger with PII redaction, `ErrorReporter` and `instrumentation.ts`.
- Covers: "API Routes with mocked data".

### 05 — Authentication

- UI primitives: Button, Field, Alert and PasswordInput, with BEM and tests.
- Login with mobile number by default and a toggle to email; registration with name, mobile, email and password.
- Server Actions for login, registration and logout, using the session primitives from 03.
- Route guard in `proxy.ts`, login rate limit and security headers.
- Covers: PDF screen 1 in full.

### 06 — Home

- Responsive private shell (mobile top bar and desktop side navigation).
- Balance and name with SSR streaming; money and date formatting in `src/shared/lib`.
- Movements with cursor pagination ("Ver más") using TanStack Query with prefetch and hydration.
- Loading (skeleton), empty and per-block error states with retry, demonstrable through `mock_read_scenario`.
- "Enviar dinero" CTA.
- Covers: PDF screen 2 in full.

### 07 — New transfer flow

- `amount` → `recipient` → `review` wizard with a Zustand draft persisted to `sessionStorage` and guards between steps.
- Amount input with a mask over cents.
- Favorites and contact creation by mobile, CLABE or card, with bank detection and save to favorites.
- Pre-confirmation summary with the three rules applied on the client.
- Covers: PDF screen 3 up to just before confirming.

### 08 — Confirmation and receipt

- `useCreateTransfer` with `Idempotency-Key`, `AbortController` at 8 s and the `ApiFailure` union.
- UI for the five outcomes: success, network error with retry, insufficient funds, timeout with status lookup, and unknown.
- Receipt at `/transfers/[transferId]`.
- DEV scenario panel and Home cache invalidation.
- Covers: PDF screen 4 and the end of screen 3.

### 09 — Final quality, deploy and documentation

- Full E2E suite (login, registration, Home, wizard and the five scenarios) on mobile and desktop.
- Accessibility and coverage review.
- Vercel deploy.
- `README.md` (how to run, libraries, limitations, time spent), `DECISIONS.md` and `AI_USAGE.md`.
- Covers: the PDF's deliverables and AI section.
