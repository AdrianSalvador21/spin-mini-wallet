# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js version caveat

This project runs **Next.js 16.4.2** with **React 19.3**, a version newer than your training data — APIs, conventions, and defaults may differ from what you expect. Before writing or changing any app code, check the bundled docs at `node_modules/next/dist/docs/` for the relevant guide (e.g. caching, routing, config, file conventions) rather than relying on prior knowledge, and heed any deprecation notices there. Particularly relevant for this repo: Cache Components/`use cache` (replaces `experimental.dynamicIO`/`experimental.useCache`/PPR flags), Turbopack-by-default, `middleware` → `proxy` rename, and the async Request APIs (`cookies`/`headers`/`params`/`searchParams` are fully async, no sync fallback).

`AGENTS.md` in the repo root is auto-generated/updated by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`) — treat the managed `<!-- BEGIN/END:nextjs-agent-* -->` blocks as owned by the tool, not hand-edited content, and commit it as-is rather than stripping it.

## Commands

```bash
npm run dev     # start dev server (Turbopack, default in v16 — no --turbopack flag needed)
npm run build   # production build (Turbopack by default)
npm run start   # run the production build
npm run lint    # ESLint via flat config (eslint.config.mjs); `next lint` was removed in v16
```

There is no test runner configured in this repo (no test script, framework, or config present).

## Architecture

This is currently the unmodified `create-next-app` scaffold (App Router) for a project intended to become a "spin mini wallet" app — no wallet-specific routes, components, or data logic exist yet. Structure:

- `app/layout.tsx` — root layout; loads Geist/Geist Mono via `next/font/google` and sets the base HTML/body shell.
- `app/page.tsx` — default home page placeholder from `create-next-app`.
- `app/globals.css` — global styles, Tailwind v4 entry point.
- `public/` — static assets (default `create-next-app` SVGs).

Path alias: `@/*` resolves to the repo root (see `tsconfig.json`).

### Notable non-default config (`next.config.ts`)

- `cacheComponents: true` + `partialPrefetching: true` — Cache Components is enabled, so **data fetching is dynamic by default**; anything meant to be cached must opt in explicitly with the `use cache` directive (plus `cacheLife`/`cacheTag` as needed). Next.js prerenders a static shell and streams dynamic content in via Suspense (Partial Prerendering). Both flags must be set together or `next dev`/`next build` will warn.
- `turbopack.rules` routes `*.css` through `@tailwindcss/turbopack`, wiring Tailwind v4 into the Turbopack pipeline (the project has no separate PostCSS config).
- `experimental.agentFeedback: true` — lets `next dev` generate review-and-send instructions for Next.js-itself issues (crashes, incorrect behavior, doc gaps) into `AGENTS.md`'s managed block; unrelated to feedback about this project's own code.

### Linting

`eslint.config.mjs` uses the flat-config format (`eslint-config-next`'s `core-web-vitals` + `typescript` presets), required since v16 moved to ESLint Flat Config and dropped the `next lint` command.
