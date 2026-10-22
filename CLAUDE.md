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
- Styling: Tailwind utilities only for page layout (flex, grid, gap, padding, breakpoints); component look-and-feel goes in a co-located `*.module.scss` written in BEM (`.block`, `.block__element`, `.block--modifier`) that consumes the CSS variables from `src/app/globals.css`'s `@theme static` block — never hardcode a hex value in SCSS. Padding, gaps, sizes, borders, type sizes and durations come from the scale tokens there (`--space-*`, `--text-size-*`, `--size-*`, `--border-width*`, `--focus-*`, `--duration-*`), never a loose measured `px` value; see `specs/00-architecture.md` §14.
- A string from a closed set (variants, tags, HTML attribute values such as a button's `type`) is never a raw literal in code: it comes from an `as const` object. A UI component's constants and unions live in a `types.ts` next to it; its `XProps` interface stays in the component file.
- One folder per component, in `src/shared/ui/` and in every `src/features/<x>/components/`: `<name>/<name>.tsx`, `<name>/<name>.test.tsx`, `<name>/<name>.module.scss` when it has styles, `<name>/types.ts` when it declares constants.
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

Services (`services/*-service.ts`) are built by factories that take `ServiceDependencies = { db, now, random, createId }` (`services/types.ts`), so tests control time, randomness and IDs instead of mocking globals. They return `Result<View, ServiceError>` and never throw for an expected failure. Since SPEC 06, the wire shapes a full response may use — `AccountView`, `MovementView`, `WalletSummary`, `MovementsPage` — live in `src/shared/lib/api/views.ts` instead of `services/views.ts`, so client code can type them without importing `@/server`; `services/views.ts` re-exports them and keeps `UserView`, `ContactView` and `TransferView` server-only until a later spec needs them on the client. These are the only shapes that may leave `src/server/`: a full account number or password hash never does, whether the caller is a Server Component or a Route Handler.

`session/password.ts` (`scrypt` + `timingSafeEqual`) and `session/token.ts` (HMAC-signed, pure, framework-free) back `session/session.ts`'s `getSession()`/`requireSession()`/`setSessionCookie()`/`clearSessionCookie()`. `requireSession()` is the only thing in this layer that throws (`UnauthorizedError`, `errors.ts`) — it is the single entry point SPEC 04's Route Handlers and SPEC 05's Server Actions use to protect themselves; `getSession()` returns `null` instead.

`container.ts`'s `getServices()` builds the four services once, from `getEnv()`, `Date`, `Math.random` and `crypto.randomUUID`, and caches the result for the life of the process. `getHttpDependencies()` builds on top of it once more, adding `Math.random`, a `setTimeout`-based `sleep`, `crypto.randomUUID`, the logger, `getErrorReporter()` and `getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE`.

### HTTP layer (`src/server/http/`, `src/app/api/v1/`)

Every `route.ts` under `src/app/api/v1/` is one line per method, binding a handler factory from `src/server/http/handlers/` to `getHttpDependencies()`: `export const GET = createWalletSummaryHandler(getHttpDependencies());`. `src/app/` keeps no logic; factories are tested directly with injected `sleep`/`random`/`logger`/`reporter` instead of mocking modules.

`http/route-handler.ts`'s `createRouteHandler<P>(deps, { mutating? }, handle)` is what every factory wraps `handle` in. In order it: reads `x-request-id` or generates one; when `mutating`, runs `csrf.ts`'s `checkMutationRequest` (`415` for a non-`application/json` `Content-Type`, `403` for a missing/foreign `Origin`) before the session check; calls `requireSession()` (`401` on `UnauthorizedError`); runs `handle`, mapping any other thrown error to `500 INTERNAL_ERROR` logged and reported with `source: "route-handler"`; sets `x-request-id` and `Cache-Control: no-store` on every response; and writes one `logger.info("api_request", …)` line with `method`, `path`, `status`, `durationMs` and, when the handler called `ctx.reportScenario(...)`, `scenario` — never the body.

The HTTP contract lives in `src/shared/lib/api/contract.ts`: `API_ERROR_CODE`, `ApiErrorBody`, `TRANSFER_SCENARIO`/`READ_SCENARIO`, the `SCENARIO_COOKIE` names (`mock_scenario`, `mock_read_scenario`) and the `x-request-id`/`Idempotency-Key` header names. It has no server dependency, so SPEC 06+ client code imports it too. `http/api-error.ts`'s `toApiError` maps a `ServiceError` to `{ status, code, details?, balance? }` through an exhaustive `switch`; `errorResponse` turns that into the `ApiErrorBody` envelope, whose `message` is always the i18n key `errors.api.<CODE>` (`src/messages/es-MX/errors.json`, gated by `errors.test.ts`).

`server/mock/scenarios.ts`'s `pickScenario`/`resolveTransferScenario`/`resolveReadScenario`/`latencyMs` are pure functions over an injected `random`, so the weighted transfer outcomes (60/10/10/10/10) and the read-scenario cookie overrides are deterministic in tests. Overrides only apply when `MOCK_ALLOW_SCENARIO_OVERRIDE=true`; an unknown cookie value is ignored rather than failing the request.

### Authentication (`src/server/auth/`, `src/features/auth/`, `src/proxy.ts`)

Server Actions follow the SPEC 04 handler pattern. `server/auth/auth-actions.ts`'s `createAuthActions({ auth, rateLimiter, logger, reporter })` owns the logic and returns `Result<UserView, AuthFailure>`; `getAuthActions()` in `container.ts` builds it once. `features/auth/actions.ts` (`"use server"`) only reads `x-request-id`, calls the factory, sets or clears the cookie and calls `redirect()` outside any `try`/`catch`. Tests inject a fake clock and services instead of mocking Next modules.

- `src/shared/lib/auth/form-state.ts` is the client/server contract: `AuthFailure` (`validation` | `invalid_credentials` | `rate_limited` | `unexpected`), `AuthFormState` (`idle` | `error`; a success redirects) and the raw `LoginFormValues`/`RegisterFormValues`. It lives in `shared/lib` because features cannot import `@/server` and the server cannot import `@/features`.
- Forms use React Hook Form with `zodResolver(schema, undefined, { raw: true })` over the domain schemas, and dispatch the action through `useActionState` inside `startTransition` from `handleSubmit`. The server re-parses the raw values. Server `validation` codes land on fields through `setError`; field errors are `ValidationCode`s translated by `useValidationMessage()` (`src/shared/i18n/`). `AuthFailureAlert` renders the other kinds with an exhaustive `switch`.
- Login rate limit (`login-rate-limiter.ts`, on `globalThis` under `Symbol.for("smw.loginRateLimiter")`): key `` `${method}:${normalizedIdentifier}` ``, 5 failures in a fixed 15-minute window from the first one, blocks even a correct password, reset on success, checked after the schema and before `scrypt`.
- `getSession()` calls `await connection()` before checking the token's expiry, because the expiry needs the current time and Cache Components would otherwise flag `new Date()` during prerender. The Vitest `node` project mocks `connection` in `src/test/server-setup.ts`.
- `proxy.ts` keeps the request id and applies `resolveRouteAccess(pathname, hasSession)` (`src/shared/lib/routes.ts`): `/` → `/login` or `/home`, `/login`/`/register` → `/home` with a session, `/home/**` and `/transfers/**` → `/login` without one. `/api/**` is never redirected; Route Handlers answer `401` JSON. An invalid or expired cookie counts as no session and is not deleted. Pages re-check the session themselves.
- Security headers come from `securityHeaders(isProduction())` (`src/shared/config/security-headers.ts`), applied in `next.config.ts` to `/:path*`; HSTS only in production.
- Public layout (`app/(public)/layout.tsx`): full-width column on mobile, a 420 px card at `md`, and from `lg` a 50/50 split with `AuthBrandPanel` on the left and the page capped at `--container-form` (400 px) on the right. On mobile the CTA sits in `ActionBar` (sticky, `safe-area-inset-bottom`); the root layout exports `viewport.interactiveWidget = "resizes-content"`.

### Home (`src/features/wallet/`, `src/server/wallet/`)

SSR prefetches both Home blocks into TanStack Query instead of leaving the client to fetch on mount. `src/server/wallet/home-loader.ts`'s `createHomeLoader(deps)` (`getHomeLoader()` in `container.ts`) applies the same `mock_read_scenario` cookie and `readOutcome` table the Route Handlers use — `server/mock/read-scenario.ts`'s `runReadScenario` is shared by both — including `movements_error` (summary `ok`, movements `error`), the scenario that demonstrates the design's partial-failure state live. `(private)/home/_sections/summary-section.tsx` and `movements-section.tsx` are async Server Components inside `<Suspense>`: each reads the session, the request id and cookies, calls the loader, and on success calls `queryClient.setQueryData` before rendering `<HydrationBoundary>`. A failed server load is simply left undehydrated, so the client query fetches on its own and one error state (driven by the query) covers both the SSR and the client failure; `now` is captured once on the server and passed down so "Hoy"/"Ayer" grouping can't mismatch between server and client.

`src/shared/lib/api/api-client.ts`'s `apiGet` returns `Result<T, ApiFailure>` (`api` | `network` | `unknown`) instead of throwing. `wallet-queries.ts`'s `walletQueryKeys`, `walletSummaryQueryOptions()` and `movementsInfiniteQueryOptions(filter)` live in `shared/lib/api`, not `features/wallet`, because SPEC 07's transfer feature reads the same summary key and features cannot import each other. `query/query-client.ts` retries only `network` failures once; its `QueryCache.onError` redirects to `/login` on `UNAUTHORIZED`, since the 30-minute session can expire while Home stays open. The movements filter ("Todos"/"Enviados"/"Recibidos") lives in the URL: `use-movement-filter.ts` reads it with `useSearchParams` and changes it with `window.history.pushState` instead of a server round trip, so a reload or back/forward keeps the selection with no extra render.

The private shell (`src/app/(private)/layout.tsx`) renders no chrome below `lg`; from `lg` it wraps `children` in a grid with a `SideNav` (its `user` slot reads `getServices().wallet.getSummary` directly, not through the scenario-aware loader — nav chrome is not the simulated API) and a `LogoutButton` footer, and wraps everything in `QueryProvider`. The hide-balance preference is the `smw_balance_hidden` cookie (`src/shared/lib/preferences/balance-visibility.ts`), read on the server rather than kept in `localStorage`, so the first paint can render it hidden with no flash.

### Transfer wizard (`src/features/transfers/`, `src/app/(private)/transfers/new/`)

`/transfers/new/{amount,recipient,review}` share a static `layout.tsx` that renders the client `WizardShell`: below `lg` an `AppBar` with the step title, "N de 3" and the back link, plus `ProgressSteps`; from `lg` "Inicio", the H1, the `Stepper` (done steps are links) and a grid of the 560 px card and the 340 px sticky `LiveSummary` (not rendered on the review). The shell always renders `children` — a layout that swaps its segment for a skeleton gets the page flagged as a dropped segment by the instant-navigation check — so each step shows `WizardSkeleton` itself until `useStepGuard` is ready. Each step's CTA lives in `WizardActions` (`ActionBar` on mobile, the card footer with "Atrás" from `lg`; `backOnMobile` for "Editar datos"). Pages read no cookies, headers or `searchParams` on the server.

- **Draft:** `draft/draft-store.ts` is a Zustand store with `persist` over `safeSessionStorage` (`src/shared/lib/session-storage/client-session.ts`, which swallows storage errors) under `SESSION_STORAGE_KEY.TRANSFER_DRAFT`, `version: 1` (another version is dropped through `migrate`, not migrated) and `skipHydration: true`. `useDraftHydration()` rehydrates once and reads `persist.hasHydrated()` through `useSyncExternalStore` (server snapshot `false`), so server and client render the same markup. `resolveStepAccess` is a pure exhaustive `switch`; `useStepGuard(step)` waits for hydration, then `router.replace`s to the first incomplete step.
- **Privacy:** the draft holds only masked data — `recipient` is `{ contactId, name, account: AccountView }`; a new recipient is always saved through `POST /api/v1/contacts` first. `claim(ownerId)` (called by the shell with the summary's user id) resets a draft left by another account. `clearClientSession()` runs from `LogoutButton`'s `onSubmit` and the `UNAUTHORIZED` redirect; it also notifies `onClientSessionClear` listeners, which is how the in-memory store is emptied, because the logout redirect is a soft navigation.
- **Idempotency key:** the review step calls `ensureIdempotencyKey()` on mount, so the key is created when entering `/transfers/new/review` and survives a reload. `setAmount` and `setRecipient` clear it when the amount, concept or contact changes, so an edited payload never reuses a key (SPEC 08 would get `409`).
- **Preview:** `draft/preview-store.ts` is a non-persisted store the amount and recipient steps write while the user types or selects (`undefined` = no preview), so `LiveSummary` updates before "Continuar". It is cleared on unmount.
- **Amount:** `AmountInput` accepts digits, one `.` and two decimals, capped at the domain maximum (`$999,999.99`), formats thousands live (`shared/lib/format/amount-input.ts`) and keeps the caret offset from the end; its height is fixed so the empty placeholder and a value lay out the same. `createAmountStepSchema(balance)` runs `parseAmount`, `validateTransferAmount` (rules 1 and 2, shared with `validateTransfer` and the server) and `validateConcept`. Without a balance the step shows `RetryAlert` and "Continuar" reports `balanceRequired`.
- **Recipient:** `ContactList` is an exhaustive `switch` over loading / error / empty / list; favorites come from `contactsQueryOptions()` (`features/transfers/api/`). `?mode=new` on the same route (`useNewRecipientMode`, `history.pushState`) swaps in `NewRecipientForm`; the shell's mode-aware title and back link sit in their own `<Suspense>` because they read `useSearchParams`. `NewRecipientForm` validates through `newContactSchema` with a resolver that maps `account.*` paths to the flat `phone`/`clabe`/`cardNumber` fields; a server `400` lands on its field (`account` → the current type's field), anything else shows `RetryAlert` and keeps the values. "Guardar en favoritos" is sent as `saveAsFavorite`; `ContactService.create` honors it, is idempotent by account (`201` created / `200` existing), upgrades but never downgrades a favorite, and rejects the user's own phone with `RECIPIENT_IS_SELF`. `useCreateContact` writes a new favorite into the cached list in name order and never retries.
- **Review:** `ReviewStep` re-runs `validateTransfer` against the current balance and lists each violation with a "Corregir" link; it takes `onConfirm?: (draft: ValidTransferDraft) => void`. The page passes none in this milestone, so "Confirmar envío" is disabled with the `confirmUnavailable` note — SPEC 08 passes `useCreateTransfer` and deletes the note.
- **API client:** `apiPost` shares `apiGet`'s failure mapping (`toResult`) and has no timeout yet; `apiGetOrThrow` feeds `queryFn`s; `getRequestId(error)` reads the reference for "Referencia: …". SPEC 08 adds `TimeoutError`, the 8 s `AbortController` and the `Idempotency-Key` header.
- **E2E:** `e2e/fixtures/wizard.ts` has `openWizardFromHome`, `startTransfer(page, amount)` and `pickContact(page, name)`, all through the UI. Tests share one database, so they never assert an exact favorites count; the new CLABE contact is idempotent across projects.

### UI primitives (`src/shared/ui/`)

`Button` (`variant`, `type`, `block`, `loading`, `loadingLabel`; `ink-900` label on orange; 50 px tall on mobile, 48 px and min 200 px wide from `lg` unless `block`; since SPEC 06 also accepts `href?: Route` to render as a `next/link` styled like the button, mutually exclusive with `loading`/`disabled`), `Field` (`label`, `id`, `type`, `inputMode`, `autoComplete`, `prefix`, `suffix`, `hint`, `error`, React 19 `ref`; 16 px input text; `aria-invalid` and `aria-describedby` to the error or hint), `PasswordInput` (44 px eye toggle with `aria-pressed`), `Alert` (`tone`, `role`; exhaustive tone → icon `switch`), `Icon` (`name`, `size`, `label`), `AppBar` (`title`, `backHref`; 44 px back hit area; "Regresar" + 32 px title from `lg`), `Segmented` (native radios in a labeled `radiogroup`, 44 px options), `ActionBar` and `BrandLogo` (`size`). Since SPEC 06: `Avatar` (`initials`, `size: AvatarSize`, `tone: AvatarTone`; `aria-hidden`, caller supplies the accessible name), `Skeleton` (`shape: SkeletonShape`, `size?`, `width?`; shimmer over `--duration-shimmer`, static under `prefers-reduced-motion`; `aria-hidden`), `BottomSheet` (`open`, `onClose`, `label`, `children`; native `<dialog>` + `showModal()` for the native focus trap and Esc — give the `<dialog>` itself an explicit `height: 100%`, since the browser's default `height: fit-content` otherwise wins over `inset: 0` on the block axis and the sheet renders collapsed at the top of the viewport with its content pushed outside it), `SideNav` (`items`, `label`, `user?`, `footer?`; hidden below `lg`, a 72 px icon-only rail with tooltip labels at `lg`, a 240 px labeled sidebar from `xl`; the current item, by `usePathname`, gets `aria-current="page"`) and `BlockErrorBoundary` (`title`, `retryLabel`; built on `catchError` from `next/error` so a `redirect()` still propagates, isolating one block's render error from the rest). Since SPEC 07: `Chip` (`pressed`, `disabled`; 44 px, `aria-pressed`), `Checkbox` (`label`, `id`, `checked`, `onChange(checked)`, `ref`; 20 px box, 44 px hit area), `SummaryList` (`items: { key, label, value }[]` as a `<dl>`), `ProgressSteps` (`current`, `total`, `label`; `role="progressbar"`), `Stepper` (`steps: { label, state: StepState, href? }[]`, `label`; an `<ol>`, `aria-current="step"`, only `done` steps with `href` link) and `AppBar`'s optional `step` counter. Each lives in its own folder with `types.ts` for its `as const` constants.

### Styling tokens (`src/app/globals.css`)

Spin's brand tokens (colors, radii, fonts) and the scale tokens (`--space-*`, `--text-size-*`, `--size-*`, `--border-width*`, `--focus-*`, `--duration-*`, `--container-*`) are declared in `@theme static` so they're always emitted as CSS variables — both Tailwind utilities and SCSS Modules read the same source. Full token table is in `specs/00-architecture.md` §14. If `next dev` ever serves a stale `globals.css` (a new token resolves to nothing), change the file's content or restart the dev server; touching the timestamp is not enough.

`next.config.ts`'s `turbopack.rules` key for the Tailwind loader must stay scoped to the filename `globals.css`, not a broad `*.css` glob — a broad glob also intercepts the CSS Sass emits for `*.module.scss` files and turns their scoped class names into global ones (component styles then silently fail to apply).

### i18n (`src/shared/i18n/`)

`next-intl` with a fixed `es-MX` locale and `America/Mexico_City` timezone (no URL prefix, no cookie/header read — safe under Cache Components prerendering). `config.ts` exports `locale`/`timeZone`; `request.ts` wires them with the messages for the plugin; `next-intl.d.ts` types `AppConfig` from `src/messages/es-MX`.

### Testing

- Vitest (`jsdom`) + Testing Library. `src/test/render.tsx` wraps components with the real `NextIntlClientProvider`/messages — use `renderWithProviders` instead of RTL's `render` directly.
- MSW's `src/test/setup.ts` calls `server.listen({ onUnhandledFrame: "error" })` — MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame` (now covers WebSocket too); any test that hits the network without a handler fails loudly.
- Vitest does not support `async` Server Components — cover those with Playwright instead.
- Playwright config has `mobile` (Pixel 7) and `desktop` (Desktop Chrome) projects. Its own server runs on port **3100** with `MOCK_DB_PATH=.data/e2e-db.json` (fixed, never read from the environment) and `MOCK_ALLOW_SCENARIO_OVERRIDE=true`, and `e2e/global-setup.ts` deletes that file before each run, so `.data/db.json` is never touched. `webServer` runs `next dev --port 3100` locally and `next build && next start --port 3100` with `CI=true`. Next refuses a second `next dev` in the same directory, so while `npm run dev` is running, run the suite with `CI=true` (PowerShell: `$env:CI="true"; npm run test:e2e`). `e2e/fixtures/auth.ts` has `loginAs`, `uniquePhone`, `uniqueEmail`, `greetingLocator` (the Home greeting renders the first name only, and only one of the mobile `<p>`/desktop `<h1>` is visible per viewport, so assert by tag rather than `getByText`) and `logout` (behind the account sheet on mobile, directly in the sidebar on desktop); failing-login tests use an unregistered phone so the rate limit never blocks the seed users. `e2e/fixtures/scenario.ts`'s `setReadScenario`/`clearReadScenario` drive the `mock_read_scenario` cookie for `e2e/home.spec.ts`. Next's route announcer is also `role="alert"`, so filter alerts by text.
- Component tests that dispatch an action through `useActionState` must resolve every pending promise they create (`Promise.withResolvers`): React entangles async transitions, and a never-settling one blocks later tests' updates.

### Experimental Next.js config (`next.config.ts`)

- `cacheComponents: true` + `partialPrefetching: true` — data fetching is dynamic by default; anything cached needs an explicit `use cache` directive. Any `cookies()`/`headers()`/`searchParams` read must be inside `<Suspense>` or the prerender breaks.
- `experimental.agentFeedback: true` — lets `next dev` write Next.js-itself feedback instructions into `AGENTS.md`'s managed block; unrelated to this project's own code review.
