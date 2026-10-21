# SPEC 01 — Scaffolding, tooling and visual foundations

> **Status:** Approved
> **Depends on:** SPEC 00
> **Date:** 2026-10-21
> **Objective:** Leave the repository ready to build features: `src/` structure, pinned runtime, styling with Spin tokens, i18n, unit and E2E testing, architecture rules and CI, all working on a branded base page.

**Branch:** `feature/01-scaffolding` (branched from `develop`, merged back through a PR to `develop`).

## Why this spec exists

Every later milestone assumes tests, lint, i18n and styling already work. If that base is built alongside the features, configuration errors get mixed with logic errors. This milestone delivers no business functionality. It delivers a branded page that proves all the pieces fit together: tokens, fonts, logo, SCSS with BEM, Tailwind and i18n messages.

## Scope

**In:**

- `main` and `develop` branches, plus the `feature/01-scaffolding` branch.
- Node 24 pinned with `.nvmrc` and `engines`.
- Code moved to `src/` with the `@/*` alias pointing to `src/*`.
- Removal of the `create-next-app` sample content.
- Sass, Spin tokens in `globals.css` (`@theme`), and SCSS partials for breakpoints and mixins.
- Montserrat and Open Sans through `next/font/google`, `lang="es-MX"` and base metadata.
- next-intl with a fixed `es-MX` locale, typed messages and the first message file.
- A `BrandLogo` component and a temporary base page at `/` that uses every piece.
- Architecture rules in ESLint (`no-restricted-imports`) and the `server-only` package.
- Vitest + Testing Library + MSW with a render helper that includes providers.
- Playwright with `mobile` and `desktop` projects, plus a smoke test.
- GitHub Actions CI workflow.
- Updates to `CLAUDE.md` and `.gitignore`.

**Out of scope (for future specs):**

- UI primitives (Button, Field, Alert, Skeleton). They are created in the first milestone that uses them (03).
- Environment variable validation, `.env.example` and `SESSION_SECRET` (02).
- `proxy.ts`, `instrumentation.ts` and the logger (02 and 03).
- TanStack Query, Zustand, React Hook Form and Zod in app code. They are installed when used.
- Security headers (03).
- Rewriting `README.md` (07).
- Vercel deploy (07).

## Data model

This milestone introduces no domain structures. The only new contract is the shape of the i18n messages:

```ts
import type messages from "@/messages/es-MX";

declare module "next-intl" {
  interface AppConfig {
    Locale: "es-MX";
    Messages: typeof messages;
  }
}
```

`src/messages/es-MX/index.ts` aggregates one JSON file per namespace. In this milestone only `common.json` exists:

```json
{
  "common": {
    "appName": "Spin Mini Wallet",
    "home": { "title": "Tu dinero, tan fácil como suena", "subtitle": "Base del proyecto lista" }
  }
}
```

## Implementation plan

Each step leaves the app running and can be committed on its own.

1. **Base branches.** Rename `master` to `main`. Create `develop` from `main` and `feature/01-scaffolding` from `develop`. Commit `CLAUDE.md` and `public/assets/shared/spin-oxxo-logo.svg`, which are currently untracked.
   - Why: the agreed flow is feature → PR → `develop`, and the user merges into `main`. Starting from a clean history avoids mixing loose files with the scaffolding.

2. **Pinned runtime.** Create `.nvmrc` with `24`. Add `"engines": { "node": ">=24 <25" }` to `package.json`. Bump `@types/node` to `^24`. Add the `"typecheck": "next typegen && tsc --noEmit"` script.
   - Why: CI, Vercel and the local machine use the same Node version. Vitest 5 requires `@types/node` 22 or 24+, and the project ships 20. `next typegen` runs first because globals such as `LayoutProps` live in `.next/types`, which does not exist on a clean checkout or in CI.

3. **Move to `src/`.** Move `app/` to `src/app/`. Change `paths` in `tsconfig.json` to `"@/*": ["./src/*"]`. Delete `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg` and `window.svg`. Replace `src/app/page.tsx` with a minimal placeholder. Verify with `npm run dev`.
   - Why: separates code from repo configuration (doc `src-folder.md`). Also, `proxy.ts` must live inside `src/` when this folder is used.

4. **Ignored files.** Add to `.gitignore`: `/.data/`, `/playwright-report/`, `/test-results/`, `/blob-report/` and `/playwright/.cache/`.
   - Why: the JSON database (`.data/`) and test reports are local artifacts that must never be pushed.

5. **Sass and tokens.** Install `sass` as a dev dependency. Rewrite `src/app/globals.css`: import Tailwind, declare the tokens from SPEC 00 section 14 as CSS variables on `:root` and expose them in `@theme` (colors, radii, fonts). Remove the dark mode block. Create `src/shared/styles/_breakpoints.scss` (`md` and `lg` mixins) and `src/shared/styles/_typography.scss` (`display` and `body` mixins).
   - Why: one source of tokens. Both Tailwind utilities and SCSS Modules consume them, so a color change happens in one place.

6. **Fonts and root layout.** Replace Geist with `Montserrat` (400, 600, 700, 800, 900) and `Open_Sans` (400, 600, 700), with `--font-display` and `--font-body` variables. Set `lang="es-MX"` on `<html>`. Define metadata with `title.template` `"%s · Spin Mini Wallet"` and a description.
   - Why: these are the fonts Spin uses in production. `next/font` serves them from our own domain, with no runtime requests to Google and no layout shift.

7. **i18n with next-intl.** Install `next-intl`. Wrap the config in `next.config.ts` with `createNextIntlPlugin("./src/shared/i18n/request.ts")`, keeping `cacheComponents`, `partialPrefetching`, `turbopack` and `experimental`. Create `src/shared/i18n/request.ts` with the fixed `es-MX` locale and `timeZone: "America/Mexico_City"`. Create `src/messages/es-MX/common.json`, `src/messages/es-MX/index.ts` and `src/shared/i18n/next-intl.d.ts` with the `AppConfig` augmentation. Wrap the layout with `NextIntlClientProvider`.
   - Why: every text lives in files from day one. Typing turns a missing key into a compile error. The fixed locale reads no cookies or headers, so it does not break Cache Components prerendering.

8. **Branded base page.** Create `src/shared/ui/brand-logo/brand-logo.tsx` and `brand-logo.module.scss` (BEM: `.brand-logo`, `.brand-logo--on-dark`), rendering `/assets/shared/spin-oxxo-logo.svg` with `next/image`. Rewrite `src/app/page.tsx` as a temporary page: purple gradient background, logo and the `common.home` texts. Layout with Tailwind utilities, custom styles in `src/app/page.module.scss`.
   - Why: it is the visible proof that tokens, fonts, logo, SCSS with BEM, Tailwind and i18n work together. Milestone 03 replaces it with the proxy redirect.

9. **Architecture rules.** Install `server-only`. Add file-pattern `no-restricted-imports` rules to `eslint.config.mjs`, following SPEC 00 section 5: `src/domain/**` does not import `react`, `next`, `@/server`, `@/features` or `@/shared/ui`; `src/server/**` does not import `@/features` or `@/shared/ui`; `src/features/*/components/**` and `src/features/*/hooks/**` do not import `@/server`. Also add `no-console` as an error, except in `src/shared/observability/**`.
   - Why: boundaries are enforced from the start instead of relying on discipline. An illegal import fails lint and CI.

10. **Vitest.** Install `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `vite-tsconfig-paths` and `@vitest/coverage-v8`. Create `vitest.config.mts`: `jsdom` environment, `src/test/setup.ts` setup, `include` `src/**/*.test.{ts,tsx}`, v8 coverage over `src/domain`, `src/server` and `src/shared/lib` with an 80 % threshold. Create `src/test/render.tsx`, which wraps with `NextIntlClientProvider` and the real messages. Write `src/shared/ui/brand-logo/brand-logo.test.tsx`. Scripts: `test` (`vitest run`), `test:watch` and `test:coverage`.
   - Why: tests run with the real messages, so a wrongly referenced text fails in the test and not in production. The coverage threshold targets logic, not markup.

11. **MSW.** Install `msw`. Create `src/test/msw/handlers.ts` (empty list) and `src/test/msw/server.ts` (`setupServer`). In `setup.ts`, wire `listen({ onUnhandledRequest: "error" })`, `resetHandlers` and `close`.
   - Why: network simulation is ready for the hooks in milestones 04 to 06. `onUnhandledRequest: "error"` guarantees no test hits the real network unnoticed.

12. **Playwright.** Install `@playwright/test` and Chromium. Create `playwright.config.ts`: `testDir: "e2e"`, `mobile` (Pixel 7) and `desktop` (Desktop Chrome) projects, `webServer` with `npm run dev` locally and `npm run build && npm run start` in CI, and an HTML `reporter`. Write `e2e/smoke.spec.ts`: the home page responds 200, `<html lang="es-MX">`, visible title and a logo with `alt`. Script `test:e2e`.
   - Why: it tests what Vitest cannot (async Server Components and the real render). The two projects validate the mobile-first and desktop designs from now on.

13. **CI.** Create `.github/workflows/ci.yml`: triggers on push to `develop` and `feature/**` and on PRs to `develop`; Node from `.nvmrc` with npm cache; steps `npm ci`, `lint`, `typecheck`, `test:coverage`, `build`, `npx playwright install --with-deps chromium` and `test:e2e`; `playwright-report` artifact on failure.
   - Why: every PR to `develop` is verified automatically. It is the safety net that replaces the discarded local hooks.

14. **Agent documentation.** Update `CLAUDE.md`: `src/` structure, new scripts, how to run a single test (`npx vitest run path/to/file.test.tsx`, `npx playwright test e2e/smoke.spec.ts --project=mobile`), boundary rules, conventions (English, no comments, BEM) and pointers to `specs/`.
   - Why: the next milestone, or any agent, starts with the right context without rebuilding it.

## Acceptance criteria

- [ ] `git branch` shows `main`, `develop` and `feature/01-scaffolding`, and `master` no longer exists.
- [ ] `node -v` in CI reports 24.x, and `package.json` declares `engines.node` `>=24 <25`.
- [ ] There is no `app/` folder at the root; `src/app/` exists.
- [ ] `npm run dev` serves `/` with the Spin logo, the title "Tu dinero, tan fácil como suena" in Montserrat and the `#531BC8` → `#7549D3` gradient background.
- [ ] The served HTML has `<html lang="es-MX">`.
- [ ] No visible text on the page is written in a `.tsx`: all of it comes from `src/messages/es-MX/common.json`.
- [ ] Changing `--color-brand-purple` in `globals.css` changes the base page color.
- [ ] `t("common.nonexistent")` produces a TypeScript error.
- [ ] `npm run lint` finishes with no errors.
- [ ] A file in `src/domain/` that imports `react` makes `npm run lint` fail.
- [ ] `npm run typecheck` finishes with no errors.
- [ ] `npm run test` passes and includes the `BrandLogo` test.
- [ ] A test that calls `fetch` on a URL with no MSW handler fails.
- [ ] `npm run test:e2e` passes on the `mobile` and `desktop` projects.
- [ ] `npm run build` finishes with no errors and no `partialPrefetching` warnings.
- [ ] The CI workflow runs green on the PR from `feature/01-scaffolding` to `develop`.
- [ ] There are no comments in any `.ts`, `.tsx`, `.scss` or `.mjs` file created or modified in this milestone.

## Decisions

- **Yes:** UI primitives are created in the milestone that uses them. Keeps this milestone focused on infrastructure and avoids components with no consumer (user decision).
- **Yes:** temporary base page at `/`. Validates tokens, fonts, SCSS, Tailwind and i18n at a glance and with a single smoke test.
- **Yes:** one JSON per message namespace, aggregated in `index.ts`. Each feature edits its own file without merge conflicts.
- **No:** a single `es-MX.json`. It grows unchecked and causes conflicts.
- **Yes:** tokens as CSS variables exposed in `@theme`. Tailwind and SCSS read the same source.
- **No:** tokens as Sass variables. They reach neither Tailwind nor the runtime.
- **Yes:** boundary rules with ESLint's native `no-restricted-imports`.
- **No:** `eslint-plugin-boundaries` or `eslint-plugin-import`. They add dependencies for something the native rule solves.
- **Yes:** Chromium only for E2E (emulating mobile and desktop). Covers both layouts with the least CI time; Firefox and WebKit can be added later.
- **Yes:** `webServer` with a production build in CI. Tests run against the same thing that gets deployed.
- **Yes:** `.nvmrc` + `engines`. Pins the version without extra tooling.

## Risks

| Risk | Mitigation |
| --- | --- |
| `createNextIntlPlugin` drops Next 16 options (`cacheComponents`, `turbopack.rules`) | Verify with `npm run build` in step 7 before moving on |
| The `@tailwindcss/turbopack` loader does not process `@theme` with custom variables | Verify in step 5 that a utility such as `bg-brand-purple` produces the expected color |
| Moving to `src/` leaves stale routes in the cache | Delete `.next/` after step 3 |
| CI E2E is slow because of the build | Chromium only and npm cache; the report is uploaded only on failure |

## What is **not** in this spec

- UI primitives (Button, Field, Alert, Skeleton).
- Environment variables, session, `proxy.ts`, logger and instrumentation.
- TanStack Query, Zustand, React Hook Form and Zod in app code.
- Security headers.
- Final README and Vercel deploy.

Each of them arrives in the milestone listed in `specs/roadmap.md`.
