# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Spin Mini Wallet is a take-home technical challenge for Spin by OXXO (FEMSA): a Next.js mini wallet web app (Login → Home → New transfer → Confirmation/Receipt) with a mocked backend. Full requirements, architecture, data model, API contracts and milestone breakdown live in `specs/` — read `specs/roadmap.md` first, then the spec for the milestone being worked on. `specs/00-architecture.md` is the global contract every milestone must respect.

## Next.js version caveat

This project runs **Next.js 16.4.2** with **React 19.3**, a version newer than your training data — APIs, conventions, and defaults may differ from what you expect. Before writing or changing any app code, check the bundled docs at `node_modules/next/dist/docs/` for the relevant guide (e.g. caching, routing, config, file conventions) rather than relying on prior knowledge, and heed any deprecation notices there. Particularly relevant for this repo: Cache Components/`use cache` (replaces `experimental.dynamicIO`/`experimental.useCache`/PPR flags), Turbopack-by-default, `middleware` → `proxy` rename, and the async Request APIs (`cookies`/`headers`/`params`/`searchParams` are fully async, no sync fallback).

`AGENTS.md` in the repo root is auto-generated/updated by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`) — treat the managed `<!-- BEGIN/END:nextjs-agent-* -->` blocks as owned by the tool, not hand-edited content, and commit it as-is rather than stripping it.

## Conventions

- All code, identifiers, file names, branch names and commit messages are in English. Commit messages follow Conventional Commits.
- Code has no comments.
- User-facing text is in Spanish (es-MX) and lives in `src/messages/es-MX/*.json`, never inline in components. Add a key, reference it with `useTranslations`/`getTranslations`; an unknown key is a TypeScript error (see `src/shared/i18n/next-intl.d.ts`).
- Styling: Tailwind utilities only for page layout (flex, grid, gap, padding, breakpoints); component look-and-feel goes in a co-located `*.module.scss` written in BEM (`.block`, `.block__element`, `.block--modifier`) that consumes the CSS variables from `src/app/globals.css`'s `@theme static` block — never hardcode a hex value in SCSS.
- Branches: `main` (user-merged), `develop` (integration), `feature/NN-slug` per milestone (branched from `develop`, merged back via PR). `specs/.spec-config.yml` has `AutoCreateBranch: false`.

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
