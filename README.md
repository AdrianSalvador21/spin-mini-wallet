# Spin Mini Wallet

A mini wallet web app built for the Spin by OXXO technical challenge: **Login → Home → New transfer → Confirmation / Receipt**, with a simulated backend that answers randomly with the five outcomes the brief asks for (success, network error, insufficient funds, timeout and unknown error).

Built with Next.js 16 (App Router) and TypeScript, mobile-first and responsive, in Spanish (es-MX), following Spin's brand.

- **Why it is built this way:** [`DECISIONS.md`](./DECISIONS.md)
- **How AI was used:** [`AI_USAGE.md`](./AI_USAGE.md)
- **Diagrams** (architecture, data flows, state): [`docs/`](./docs/README.md)
- **Specs**, one per milestone: [`specs/`](./specs/README.md)

## Contents

- [Quick start](#quick-start)
- [Demo users](#demo-users)
- [Forcing each outcome](#forcing-each-outcome)
- [Scripts](#scripts)
- [What it does](#what-it-does)
- [Libraries](#libraries)
- [Project structure](#project-structure)
- [Deploy](#deploy)
- [Known limitations](#known-limitations)
- [Time spent](#time-spent)

## Quick start

Requirements: **Node.js 24** (pinned in `.nvmrc`) and npm.

```bash
git clone https://github.com/AdrianSalvador21/spin-mini-wallet.git
cd spin-mini-wallet
cp .env.example .env.local
```

Edit `.env.local` and set `SESSION_SECRET` to any random string of at least 32 characters (the app refuses to start without it). To see the DEV panel that forces each outcome, also set the two flags to `true`:

```bash
SESSION_SECRET=any-random-string-of-at-least-32-characters
MOCK_DB_PATH=.data/db.json
MOCK_ALLOW_SCENARIO_OVERRIDE=true
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
```

Then:

```bash
npm ci
npm run dev
```

Open http://localhost:3000 and sign in with a demo user. The mock database is created at `.data/db.json` on the first request; delete that file to reset every balance and movement.

## Demo users

| User | Mobile | Email | Password | Shows |
| --- | --- | --- | --- | --- |
| Mariana López | `5512345678` | `mariana@spin.test` | `Spin2026` | $12,450.80, 25 movements (pagination), four favorites: phone, CLABE, card and Diego |
| Diego Ramírez | `5587654321` | `diego@spin.test` | `Spin2026` | $500.00 and no movements (empty states) |

You can also register a new user: it starts with $1,000.00 and no movements. Sending money from Mariana to Diego's phone credits Diego's wallet too.

## Forcing each outcome

The confirmation is random (60 % success, 10 % each for network error, insufficient funds, timeout and unknown error). With both flags on, a **DEV** pill appears on every private page:

- **Envío** forces one transfer outcome.
- **Lecturas** forces Home's loading (`slow`), error (`error`) or partial error (`movements_error`) states.

The full guide, with every use case, is in [`docs/dev-panel.md`](./docs/dev-panel.md). The panel only writes two cookies that the server reads, and the server ignores them unless `MOCK_ALLOW_SCENARIO_OVERRIDE=true`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (Turbopack) on port 3000 |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint, including the layer-boundary rules |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm run test` | Unit and component tests (Vitest) |
| `npm run test:coverage` | Same, with coverage gates: 100 % on `src/domain`, 80 % on the server and `src/shared/lib` |
| `npm run test:e2e` | Playwright on a mobile (Pixel 7) and a desktop project |

E2E runs its own server on port 3100 with its own database (`.data/e2e-db.json`, reset on each run), so it never touches your data. Install the browser once with `npx playwright install chromium`. Next.js refuses a second dev server in the same folder, so while `npm run dev` is running, run E2E against a production build: `CI=true npm run test:e2e` (PowerShell: `$env:CI="true"; npm run test:e2e`).

CI (GitHub Actions) runs lint, typecheck, unit tests with coverage, build and E2E.

## What it does

- **Login** by mobile or email with format and required-field validation, loading and error states, a mocked session in a signed cookie, and a login rate limit. **Registration** is included.
- **Home** with the user's name and balance (with a hide-balance toggle), recent movements grouped by day with "Ver más" pagination and a Todos / Enviados / Recibidos filter, and loading, empty and error states per block.
- **New transfer** in three steps: amount (with quick chips and an optional concept), recipient (a favorite, or a new contact by mobile, CLABE with bank detection, or card, saved to favorites), and a review with the fee and the balance after.
- **Business rules** (amount greater than zero, enough balance, a recipient) enforced in the domain and checked in the wizard, in the API and inside the server's write lock.
- **Confirmation** with an idempotency key, an 8-second timeout, and a screen for each of the five outcomes, plus a status lookup after a timeout. Success lands on a reloadable **receipt** with folio and tracking key, and a share action.

## Libraries

| Library | Why |
| --- | --- |
| Next.js 16 + React 19 | App Router: Server Components, streaming, Server Actions and Route Handlers in one framework |
| TypeScript (strict) | Branded ids and cents, discriminated unions, no `any` |
| TanStack Query 5 | Server state: caching, retries, infinite pagination, invalidation and SSR hydration |
| Zustand 5 | The transfer draft (persisted per tab) and the submission state, with no provider |
| React Hook Form + Zod 4 | Forms validated by the same schemas the server uses |
| next-intl 4 | Typed es-MX messages; no text inside components |
| Tailwind CSS 4 + Sass | Tailwind for page layout, SCSS Modules (BEM) for components, one set of design tokens |
| Vitest + Testing Library + MSW | Unit, hook and component tests with realistic network mocks |
| Playwright | E2E on mobile and desktop, with every outcome forced by cookie |

## Project structure

```text
src/
  app/          routes, layouts and Route Handlers (composition only)
  domain/       pure TypeScript: money, validators, the three business rules
  server/       services, repositories, JSON database, session, HTTP handlers, mock scenarios
  features/     auth, wallet, transfers, dev-tools: UI, hooks and actions per feature
  shared/       UI primitives, API client, i18n, formatting, observability
  messages/     es-MX texts
e2e/            Playwright specs
docs/           architecture, data flows, state, DEV panel
specs/          the challenge, the global contract and one spec per milestone
```

Layer boundaries are enforced by ESLint. See [Architecture](./docs/architecture.md) for the diagrams.

## Deploy

Deployed on Vercel: **https://spin-mini-wallet.vercel.app** (demo users below; the DEV panel is on).

Environment variables, set for every environment (the build validates them too):

| Variable | Value |
| --- | --- |
| `SESSION_SECRET` | A random string of at least 32 characters |
| `MOCK_DB_PATH` | `/tmp/spin-mini-wallet/db.json` |
| `MOCK_ALLOW_SCENARIO_OVERRIDE` | `true` |
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS` | `true` |

The scenario override and the DEV panel are on in the deploy on purpose, so every outcome can be shown on demand.

## Known limitations

- **The database is a JSON file.** On Vercel it lives in each instance's `/tmp`: it resets when the instance stops, and two instances do not share it. **Use the demo users** (they exist on every instance); a user registered on one instance may not exist on the next request's instance. When that happens the app clears the session and returns to the login instead of failing.
- **Simulated "insufficient funds".** The random outcome represents a balance that changed between the review and the confirmation, so it can appear even when the balance shown earlier was enough. A real lack of funds is caught earlier by the business rules.
- **The timeout scenario** waits 12 seconds on the server. On a serverless platform the function could be stopped earlier; the app still shows "Todavía no encontramos tu envío", which is the designed behavior for an unknown result.
- **Simulated latency:** reads wait 300–800 ms on purpose, so loading states and streaming are visible.
- **The login rate limit is in memory**, so it applies per server instance.
- **White label on the orange button** (2.9:1) follows Spin's brand and is below WCAG AA for normal text.
- **Not implemented:** real authentication (OTP, password recovery), recent recipients and contact search, editing or deleting contacts, dark mode, languages other than es-MX.

## Time spent

Two days. About 10 hours of hands-on time, spent mostly on planning, iterating the specs, researching alternatives and design.
