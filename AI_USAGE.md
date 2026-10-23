# AI usage

AI was a core part of how I built this project, inside a method I set up on purpose: I defined and approved every decision, and the AI drafted, implemented and checked under my direction. This file answers the three questions in the brief: which tools I used and where, what I accepted and what I corrected or rejected, and which decisions were mine.

## 1. Tools and where I used them

| Tool | Where |
| --- | --- |
| **Claude.ai** (design artifacts) | The visual design and its iterations: the original mini wallet design (with tokens I took from spinbyoxxo.com.mx), the mobile review, the desktop proposal, and the "brand in the flow" canvas where I compared Home proposals A and B. I reviewed each round and approved or rejected sections. The approved design is kept in [`specs/design/`](./specs/design/mini-wallet-design.html) |
| **Claude Code** (CLI agent) | I wrote the specs together with it: we researched alternatives, iterated ideas, and defined how we would work (conventions, branch and commit flow, review steps). I then used it to implement each spec step by step, run lint, typecheck, unit and E2E tests, review the code, audit the project before delivery, and draft these documents |

I left [`CLAUDE.md`](./CLAUDE.md) and [`AGENTS.md`](./AGENTS.md) in the repo on purpose: they are the project instructions the agent read in every session (conventions, boundaries, commands), so they show exactly what context I gave the AI.

## 2. Method: spec-driven development

I followed the same loop for every milestone, and nothing was implemented without a spec I had approved.

1. **Source material.** I transcribed the PDF into [`specs/challenge.md`](./specs/challenge.md) and summarized the approved design there, so every session started from the same facts.
2. **Global contract.** I fixed the architecture, data model, API contract, security and testing strategy in [`specs/00-architecture.md`](./specs/00-architecture.md), and split the work into milestones in [`specs/roadmap.md`](./specs/roadmap.md).
3. **One spec per milestone, through questions.** For each milestone the agent read the previous specs and the code, then asked me blocks of concrete questions with options and a recommendation (scope, data, persistence, states, risks). I answered, picked or rejected options, and the spec was written with a "Decisions" section that records what I chose **and what I discarded**. The spec stayed in Draft until I re-read it and marked it Approved.
4. **Step-by-step implementation.** Each spec has numbered steps that leave the app working. After each step I reviewed the diff and the explanation of what was done and why, asked for changes when needed, and only then it was committed (one Conventional Commit per step).
5. **Iteration.** When a review or a test found something, I had the fix go into the code and, when it changed a decision, back into the specs, so they never drifted from the code.
6. **Delivery audit.** Before the last milestone I audited the whole project against the PDF: missing deliverables, defects, over-engineering and deviations from the plan. The findings became [SPEC 09](./specs/09-delivery.md).

When a milestone grew too large I split it: the original "domain and backend" milestone became three (domain, server core, HTTP API).

## 3. What I accepted directly

- The overall layering (domain, server, features, shared) and enforcing it with ESLint import rules.
- Injected dependencies (`now`, `random`, `createId`, `sleep`) in services and handlers, so tests control time and randomness instead of mocking globals.
- `Result<T, E>` instead of exceptions for expected failures, and exhaustive `switch`es with an `assertUnreachable` helper.
- TanStack Query for server state with SSR hydration, and Zustand for the transfer draft.
- The idempotency-key design and treating a timeout as "unknown" with a status lookup.
- Most test scaffolding: MSW handlers, factories, the Playwright projects and fixtures.

"Accepted directly" still means reviewed: each of these came with its trade-offs written in a spec before I approved it.

## 4. What I corrected or rejected

**Corrected after review or testing:**

- **Design fidelity during implementation.** I corrected places where the implementation drifted from the approved design.
- **Code conventions.** I tightened them as the project grew: no comments, no raw string literals for closed sets (they come from `as const` objects), typed contracts shared between client and server.
- **Styles from the design system.** I replaced loose measured values in SCSS with variables from the shared tokens, so every size, spacing and color comes from one place.
- **Dead code.** I had unused code removed, such as a transfer recipient branch the client never sent, instead of keeping it "for completeness".
- **Folder structure and naming.** I renamed and reorganized folders so every component lives in its own folder with its test, styles and constants.
- **Loading experience.** I adjusted the skeletons to match the real layout and added more visual loading states, so users always see what is coming.
- **Defects caught before delivery.** My audit found that the API accepted fractional cents and that the transfer endpoint drew the simulated scenario before applying the business rules; both were fixed with tests. Running the app also surfaced platform issues that were fixed (a Windows file-lock race in the JSON database, a CSS loader rule that made module class names global).

**Rejected:**

- **React Context as the state solution.** Given the scope, the deadline, and what TanStack Query and Zustand already gave me (caching, retries, pagination, persistence), Context alone would have meant rebuilding those pieces by hand.
- **Design proposals that added scope.** I cut "Recientes" and contact search from the recipient step: useful for the user, but outside the scope and the time available.
- **Contrast versus brand.** The AI recommended a dark label on the orange button to pass WCAG AA. I chose Spin's white label (2.9:1) to match the brand, as a documented trade-off.
- **Persistence.** I rejected an in-memory fallback database and kept the JSON file only, documenting its limits on Vercel.
- **Tooling and libraries.** I rejected Husky, lint-staged, commitlint and Prettier (CI covers quality) and component libraries such as shadcn/ui, because composing my own components is part of what is evaluated.
- **Simplifications I did not want.** When removing the draggable DEV panel, the live preview store or the simulated SSR latency was proposed, I kept them and documented why.

## 5. Decisions I made

- **Application architecture:** the layers, their boundaries, Server Actions for auth and Route Handlers for data, and the transfer endpoint's check order.
- **Repository structure:** feature folders, one folder per component, `specs/` and `docs/`, and the branch model (`main`, `develop`, one `feature/NN-slug` per milestone).
- **Implementation rules:** code conventions (English code, no comments, Conventional Commits, every user-facing text in es-MX message files), strict typing with branded types and discriminated unions, and constants instead of raw literals for every closed set.
- **Design system:** one set of tokens shared by Tailwind and SCSS, BEM for components, Tailwind only for layout, and atomic UI components (`Button`, `Field`, `Alert`, `Skeleton`, `BrandLogo`…) reused across the whole app.
- **Dependencies and technologies:** Next.js App Router, TanStack Query, Zustand, React Hook Form with Zod, next-intl, Vitest with MSW, and Playwright.
- **Error and domain contracts:** the domain returns error codes instead of messages, one error envelope for the API, and a request id visible on every error screen.
- **Product and brand:** the brand direction, the white-on-orange CTA, Home proposal B over A, the processing orbit, and the seed data that makes every state demonstrable.
- **Delivery:** deploying on Vercel with its limits documented, the repo docs in English, and keeping the specs and agent instructions in the repo as evidence of the process.

## 6. How I verified the AI's output

- Lint, typecheck, unit tests with coverage gates (100 % on the domain, 80 % elsewhere) and the Playwright suite on mobile and desktop, run locally and in CI.
- Running the app and looking at it: I checked every UI step in the browser, on mobile and desktop widths, against the approved design.
- Reading every diff before it was committed, one step at a time.
