# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Spin Mini Wallet is a take-home technical challenge for Spin by OXXO (FEMSA): a Next.js mini wallet web app (Login → Home → New transfer → Confirmation/Receipt) with a mocked backend. Full requirements, architecture, data model, API contracts and milestone breakdown live in `specs/`. Before writing or implementing any spec, read in this order:

1. `specs/challenge.md`: the original challenge brief (screens, business rules, deliverables, evaluation criteria, deadline) and the design reference, including where SPEC 00 overrides the design.
2. `specs/roadmap.md`: which milestone is next.
3. `specs/00-architecture.md`: the global contract every milestone must respect.
4. The spec for the milestone being worked on.

UI milestones must also follow `specs/design/mini-wallet-design.html`, the approved design: open it in a browser, or read the screens summary in `specs/challenge.md` §8. It is also published at https://claude.ai/artifact/LTCjdMCcyowCVxe9RZqSbr. Specs are self-contained on purpose: they run in separate sessions, so nothing a spec needs may live only in chat history.

## Next.js version caveat

This project runs **Next.js 16.4.2** with **React 19.3**, a version newer than your training data — APIs, conventions, and defaults may differ from what you expect. Before writing or changing any app code, check the bundled docs at `node_modules/next/dist/docs/` for the relevant guide (e.g. caching, routing, config, file conventions) rather than relying on prior knowledge, and heed any deprecation notices there. Particularly relevant for this repo: Cache Components/`use cache` (replaces `experimental.dynamicIO`/`experimental.useCache`/PPR flags), Turbopack-by-default, `middleware` → `proxy` rename, and the async Request APIs (`cookies`/`headers`/`params`/`searchParams` are fully async, no sync fallback).

`AGENTS.md` in the repo root is auto-generated/updated by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`) — treat the managed `<!-- BEGIN/END:nextjs-agent-* -->` blocks as owned by the tool, not hand-edited content, and commit it as-is rather than stripping it.

## Conventions

- All code, identifiers, file names, branch names and commit messages are in English. Commit messages follow Conventional Commits.
- Code has no comments.
- User-facing text is in Spanish (es-MX) and lives in `src/messages/es-MX/*.json`, never inline in components. Add a key, reference it with `useTranslations`/`getTranslations`; an unknown key is a TypeScript error (see `src/shared/i18n/next-intl.d.ts`).
- Styling: Tailwind utilities only for page layout (flex, grid, gap, padding, breakpoints); component look-and-feel goes in a co-located `*.module.scss` written in BEM (`.block`, `.block__element`, `.block--modifier`) that consumes the CSS variables from `src/app/globals.css`'s `@theme static` block — never hardcode a hex value in SCSS.
- Branches: `main` (user-merged), `develop` (integration), `feature/NN-slug` per milestone (branched from `develop`, merged back via PR). `specs/.spec-config.yml` has `AutoCreateBranch: false`.
- No nested ternaries to branch on a discriminated union's tag. Use a `switch` over the discriminant, one `case` per member, exhaustive via a shared `assertUnreachable(value: never)` helper in the `default` branch (see `src/domain/shared/assert-unreachable.ts`). Cover that `default` with a test that casts an invalid tag through `as unknown as <UnionType>`, so the 100 %/80 % coverage gates stay meaningful instead of excluding it.
- A discriminated union's literal tag values (e.g. `RecipientAccount.type`) are declared once as an `as const` object next to the union in its `types.ts`, and every comparison or object literal that sets the tag references that constant — never the raw string literal — outside of test fixtures asserting the actual wire format.

## Commands

```bash
npm run dev           # start dev server (Turbopack, default in v16)
npm run build          # production build
npm run start           # run the production build
npm run lint             # ESLint flat config (eslint.config.mjs)
npm run typecheck   # next typegen && tsc --noEmit (route types must be generated first)
npm run test              # vitest run
npm run test:watch   # vitest
npm run test:coverage # vitest run --coverage (80% threshold on src/domain, src/server, src/shared/lib)
npm run test:e2e      # playwright test (mobile + desktop projects)
```

Run a single Vitest file: `npx vitest run src/shared/ui/brand-logo/brand-logo.test.tsx`
Run a single Playwright test on one project: `npx playwright test e2e/smoke.spec.ts --project=mobile`

Node version is pinned via `.nvmrc` / `engines` (24.x).

## Architecture

Code lives under `src/` (alias `@/*` → `src/*`). Planned structure, built incrementally per milestone (see `specs/00-architecture.md` §5):

```text
src/
  app/              routes, layouts, route handlers — no business logic
  domain/           pure TypeScript: types, rules, validators (framework-free)
  server/           server-only code (imports "server-only")
  features/         UI + hooks + server actions, one folder per feature
  shared/
    ui/             reusable primitives (*.tsx + *.module.scss + *.test.tsx)
    i18n/           next-intl config (locale fixed to es-MX)
    styles/         Sass partials (_breakpoints.scss, _typography.scss)
  messages/es-MX/   one JSON per namespace, aggregated in index.ts
  test/             Vitest setup, render helper, MSW handlers/server
e2e/                Playwright specs
```

### Enforced boundaries (`eslint.config.mjs`)

`no-restricted-imports` rules make these illegal, not just discouraged:

- `src/domain/**` cannot import `react`, `next`, `next-intl`, `@/server`, `@/features`, or `@/shared/ui`.
- `src/server/**` cannot import `@/features` or `@/shared/ui`.
- `src/features/<x>/**` cannot import another feature (`auth`, `wallet`, `transfers`).
- `src/features/<x>/{components,hooks}/**` additionally cannot import `@/server` (only `actions.ts` files may).
- `no-console` is an error everywhere under `src/` except `src/shared/observability/**`.

### Domain layer (`src/domain/`)

Framework-free TypeScript, one folder per concept (`shared`, `money`, `user`, `contact`, `wallet`, `transfer`), each with `types.ts` (entities, branded IDs), `validators.ts` (pure `Result<T, ValidationCode>` functions) and, where it applies, `schemas.ts` (Zod) and `rules.ts` (business rules). Nothing here throws for an expected failure: validators return `Result<T, E>` (`ok`/`err` from `src/domain/shared/result.ts`) and business rules in `transfer/rules.ts` return every violation at once, not just the first.

Error codes are the only thing the domain says about a failure. `ValidationCode` (`src/domain/shared/validation-codes.ts`) is a closed, English, framework-free union — the domain never produces a user-facing message. To add a new code:

1. Add it to the `VALIDATION_CODES` array (its `ValidationCode` union member follows automatically).
2. Return it from the validator that detects the failure.
3. Add its Spanish copy to `src/messages/es-MX/errors.json` under `errors.validation.<CODE>` — `src/messages/es-MX/errors.test.ts` fails the build if a code has no message, so this step isn't optional.

Zod schemas (`schemas.ts` files) wrap the validators above through `fromValidator` (`src/domain/shared/validation.ts`): it turns a `(input: string) => Result<T, ValidationCode>` function into a Zod transform whose issue `message` is the `ValidationCode` itself, so a schema never invents its own error text. `toFieldErrors` (same file) turns a `z.ZodError` into `Record<string, ValidationCode[]>`, which is what Route Handlers and forms consume.

`src/domain/**` has its own 100 % coverage threshold in `vitest.config.mts` (the rest of the app keeps 80 %) — a pure function with an untested branch is a bug waiting in a financial app, not an acceptable gap.

### Server core (`src/server/`)

Every file under `src/server/` starts with `import "server-only"`. Vitest runs `src/server/**` under the `node` project (see `vitest.config.mts`), where `server-only` is aliased to its empty module so these files can be imported from tests at all; everything else runs under the `dom` (jsdom) project.

`db/json-database.ts` exposes a `Database` with `read`/`transaction`, backed by a single JSON file at `getEnv().MOCK_DB_PATH`. `transaction` re-reads the file, runs the callback against an in-memory snapshot, and writes it back atomically (temp file + `rename`); if the callback throws, nothing is written. A single process-wide lock (`Symbol.for` on `globalThis`) serializes transactions even if Next loads the module more than once. `repositories/*` are small synchronous objects (`findById`, `insert`, …) over that snapshot — `find`/`list` return live references into it, so a service can mutate a wallet's `balance` directly inside a `transaction` and the change gets persisted when it writes back. Services only ever see `Database`/`Repositories`, never the file path, so a real database could replace the JSON file without touching services or UI.

Services (`services/*-service.ts`) are built by factories that take `ServiceDependencies = { db, now, random, createId }` (`services/types.ts`), so tests control time, randomness and IDs instead of mocking globals. They return `Result<View, ServiceError>` and never throw for an expected failure. The views in `services/views.ts` (`UserView`, `AccountView`, `ContactView`, `MovementView`, `TransferView`) are the only shapes that may leave `src/server/`: a full account number or password hash never does, whether the caller is a Server Component or (from SPEC 04 onward) a Route Handler.

`session/password.ts` (`scrypt` + `timingSafeEqual`) and `session/token.ts` (HMAC-signed, pure, framework-free) back `session/session.ts`'s `getSession()`/`requireSession()`/`setSessionCookie()`/`clearSessionCookie()`. `requireSession()` is the only thing in this layer that throws (`UnauthorizedError`, `errors.ts`) — it is the single entry point SPEC 04's Route Handlers and SPEC 05's Server Actions use to protect themselves; `getSession()` returns `null` instead.

`container.ts`'s `getServices()` builds the four services once, from `getEnv()`, `Date`, `Math.random` and `crypto.randomUUID`, and caches the result for the life of the process. `getHttpDependencies()` builds on top of it once more, adding `Math.random`, a `setTimeout`-based `sleep`, `crypto.randomUUID`, the logger, `getErrorReporter()` and `getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE`.

### HTTP layer (`src/server/http/`, `src/app/api/v1/`)

Every `route.ts` under `src/app/api/v1/` is one line per method, binding a handler factory from `src/server/http/handlers/` to `getHttpDependencies()`: `export const GET = createWalletSummaryHandler(getHttpDependencies());`. `src/app/` keeps no logic; factories are tested directly with injected `sleep`/`random`/`logger`/`reporter` instead of mocking modules.

`http/route-handler.ts`'s `createRouteHandler<P>(deps, { mutating? }, handle)` is what every factory wraps `handle` in. In order it: reads `x-request-id` or generates one; when `mutating`, runs `csrf.ts`'s `checkMutationRequest` (`415` for a non-`application/json` `Content-Type`, `403` for a missing/foreign `Origin`) before the session check; calls `requireSession()` (`401` on `UnauthorizedError`); runs `handle`, mapping any other thrown error to `500 INTERNAL_ERROR` logged and reported with `source: "route-handler"`; sets `x-request-id` and `Cache-Control: no-store` on every response; and writes one `logger.info("api_request", …)` line with `method`, `path`, `status`, `durationMs` and, when the handler called `ctx.reportScenario(...)`, `scenario` — never the body.

The HTTP contract lives in `src/shared/lib/api/contract.ts`: `API_ERROR_CODE`, `ApiErrorBody`, `TRANSFER_SCENARIO`/`READ_SCENARIO`, the `SCENARIO_COOKIE` names (`mock_scenario`, `mock_read_scenario`) and the `x-request-id`/`Idempotency-Key` header names. It has no server dependency, so SPEC 06+ client code imports it too. `http/api-error.ts`'s `toApiError` maps a `ServiceError` to `{ status, code, details?, balance? }` through an exhaustive `switch`; `errorResponse` turns that into the `ApiErrorBody` envelope, whose `message` is always the i18n key `errors.api.<CODE>` (`src/messages/es-MX/errors.json`, gated by `errors.test.ts`).

`server/mock/scenarios.ts`'s `pickScenario`/`resolveTransferScenario`/`resolveReadScenario`/`latencyMs` are pure functions over an injected `random`, so the weighted transfer outcomes (60/10/10/10/10) and the read-scenario cookie overrides are deterministic in tests. Overrides only apply when `MOCK_ALLOW_SCENARIO_OVERRIDE=true`; an unknown cookie value is ignored rather than failing the request.

### Styling tokens (`src/app/globals.css`)

Spin's brand tokens (colors, radii, fonts) are declared in `@theme static` so they're always emitted as CSS variables — both Tailwind utilities and SCSS Modules read the same source. Full token table is in `specs/00-architecture.md` §14.

`next.config.ts`'s `turbopack.rules` key for the Tailwind loader must stay scoped to the filename `globals.css`, not a broad `*.css` glob — a broad glob also intercepts the CSS Sass emits for `*.module.scss` files and turns their scoped class names into global ones (component styles then silently fail to apply).

### i18n (`src/shared/i18n/`)

`next-intl` with a fixed `es-MX` locale and `America/Mexico_City` timezone (no URL prefix, no cookie/header read — safe under Cache Components prerendering). `config.ts` exports `locale`/`timeZone`; `request.ts` wires them with the messages for the plugin; `next-intl.d.ts` types `AppConfig` from `src/messages/es-MX`.

### Testing

- Vitest (`jsdom`) + Testing Library. `src/test/render.tsx` wraps components with the real `NextIntlClientProvider`/messages — use `renderWithProviders` instead of RTL's `render` directly.
- MSW's `src/test/setup.ts` calls `server.listen({ onUnhandledFrame: "error" })` — MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame` (now covers WebSocket too); any test that hits the network without a handler fails loudly.
- Vitest does not support `async` Server Components — cover those with Playwright instead.
- Playwright config has `mobile` (Pixel 7) and `desktop` (Desktop Chrome) projects; `webServer` runs `next dev` locally and a production build (`next build && next start`) when `CI=true`.

### Experimental Next.js config (`next.config.ts`)

- `cacheComponents: true` + `partialPrefetching: true` — data fetching is dynamic by default; anything cached needs an explicit `use cache` directive. Any `cookies()`/`headers()`/`searchParams` read must be inside `<Suspense>` or the prerender breaks.
- `experimental.agentFeedback: true` — lets `next dev` write Next.js-itself feedback instructions into `AGENTS.md`'s managed block; unrelated to this project's own code review.
