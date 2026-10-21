# Roadmap — Spin Mini Wallet

> **Status:** Approved
> **Depends on:** SPEC 00
> **Date:** 2026-10-21
> **Objective:** List the project's 7 milestones, their order, branch and spec, so it is always clear which one is next to write and implement.

## How to use it

- The global contract lives in [`00-architecture.md`](./00-architecture.md). No milestone contradicts it; if something changes, SPEC 00 is updated first.
- Each milestone has its own spec (`NN-slug.md`). The spec is written with `/spec` when the milestone starts, using what was learned in the previous ones.
- Each milestone is implemented on `feature/NN-slug`, branched from `develop` and merged back through a PR to `develop`. The user merges `develop` into `main`.
- A milestone is done when its spec moves to `Implemented` and its PR is merged. Only then is the next one written.

## Status

| # | Milestone | Spec | Branch | Status |
| --- | --- | --- | --- | --- |
| 00 | Architecture and global contracts | [00-architecture.md](./00-architecture.md) | — | Approved |
| 01 | Scaffolding, tooling and visual foundations | [01-scaffolding.md](./01-scaffolding.md) | `feature/01-scaffolding` | Approved |
| 02 | Domain and simulated backend | To be written | `feature/02-domain-mock-api` | Pending |
| 03 | Authentication and session | To be written | `feature/03-auth` | Pending |
| 04 | Home | To be written | `feature/04-home` | Pending |
| 05 | New transfer flow | To be written | `feature/05-transfer-flow` | Pending |
| 06 | Confirmation and receipt | To be written | `feature/06-confirmation-receipt` | Pending |
| 07 | Final quality, deploy and documentation | To be written | `feature/07-delivery` | Pending |

**Next spec to write:** 02 — Domain and simulated backend (after implementing 01).

## Milestones

### 01 — Scaffolding, tooling and visual foundations

Repo base: branches, Node 24, `src/`, Sass and Spin tokens, fonts, next-intl, ESLint boundary rules, Vitest + MSW, Playwright and CI. Delivers a branded page that proves everything fits together. See [01-scaffolding.md](./01-scaffolding.md).

### 02 — Domain and simulated backend

- Domain models with branded types and money in cents.
- Validators (mobile, email, CLABE with check digit, card with Luhn, password) and the three business rules.
- JSON database with mutex and atomic writes, seed (Mariana and Diego), repositories and services.
- `/api/v1/*` Route Handlers with the error envelope.
- Scenario engine with cookie override, idempotency and environment validation.
- `proxy.ts` with `x-request-id`, logger with PII redaction, `ErrorReporter` and `instrumentation.ts`.
- Covers: "API Routes with mocked data" and "business rules not only in the UI".

### 03 — Authentication and session

- UI primitives: Button, Field, Alert and PasswordInput, with BEM and tests.
- Login with mobile number by default and a toggle to email; registration with name, mobile, email and password.
- Server Actions for login, registration and logout.
- Signed `smw_session` cookie, guard in `proxy.ts` and `requireSession()`.
- Login rate limit and security headers.
- Covers: PDF screen 1 in full.

### 04 — Home

- Responsive private shell (mobile top bar and desktop side navigation).
- Balance and name with SSR streaming.
- Movements with cursor pagination ("Ver más") using TanStack Query with prefetch and hydration.
- Loading (skeleton), empty and per-block error states with retry.
- "Enviar dinero" CTA.
- Covers: PDF screen 2 in full.

### 05 — New transfer flow

- `amount` → `recipient` → `review` wizard with a Zustand draft persisted to `sessionStorage` and guards between steps.
- Amount input with a mask over cents.
- Favorites and contact creation by mobile, CLABE or card, with save to favorites.
- Pre-confirmation summary with the three rules applied on the client.
- Covers: PDF screen 3 up to just before confirming.

### 06 — Confirmation and receipt

- `useCreateTransfer` with `Idempotency-Key`, `AbortController` at 8 s and the `ApiFailure` union.
- UI for the five outcomes: success, network error with retry, insufficient funds, timeout with status lookup, and unknown.
- Receipt at `/transfers/[transferId]`.
- DEV scenario panel and Home cache invalidation.
- Covers: PDF screen 4 and the end of screen 3.

### 07 — Final quality, deploy and documentation

- Full E2E suite (login, registration, Home, wizard and the five scenarios) on mobile and desktop.
- Accessibility and coverage review.
- Vercel deploy.
- `README.md` (how to run, libraries, limitations, time spent), `DECISIONS.md` and `AI_USAGE.md`.
- Covers: the PDF's deliverables and AI section.
