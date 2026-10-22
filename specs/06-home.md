# SPEC 06 — Home: private shell, balance and movements

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 02, SPEC 03, SPEC 04, SPEC 05
> **Date:** 2026-10-22
> **Objective:** Build PDF screen 2 (balance, name, recent movements with loading, empty and error states, and the "Enviar dinero" CTA) inside the responsive private shell, with SSR streaming hydrated into TanStack Query and cursor pagination on the client.

**Branch:** `feature/06-home` (branched from an up-to-date `develop`, merged back through a PR to `develop`).

## Why this spec exists

SPEC 05 left a `/home` placeholder with a greeting and a logout button. This milestone replaces it with the real Home and builds the private shell that SPEC 07 and 08 render inside. It is also the first milestone where Client Components read the API, so it brings in TanStack Query, a minimal `apiClient` and the first MSW handlers.

The approved design (`specs/design/mini-wallet-design.html`, summarized in `challenge.md` §8) defines Home three times: the original screens, the *mobile review* and the *desktop proposal*. Where they differ, the later ones win. `challenge.md` §8.4 left seven details for this spec to decide; the "Decisions" section records each one.

Data reaches the page in two ways (user decision). Server Components load the balance and the first page of movements through a server loader, write them into a per-request `QueryClient` and hand it over with `HydrationBoundary`. The client then owns pagination, the filter and retries through the `/api/v1/*` endpoints. The server loader applies the same `mock_read_scenario` semantics as the Route Handlers (user decision), so the skeleton and the error states can be shown on the first load, not only after a client interaction.

## Scope

**In:**

- SPEC 00 §4, §8, §9, §12 and §14, `challenge.md` §8.4 and `roadmap.md` updated with the decisions below.
- `@tanstack/react-query` as a dependency.
- Private-layout tokens, the shadow tokens, and the `xl` (1280 px) breakpoint in `_breakpoints.scss`.
- Domain: `Movement.counterpartyAccount`, `maskPhone`, `validateMovementDirection` and the `DIRECTION_INVALID` code.
- Server: the seed and `TransferService` fill `counterpartyAccount`, `schemaVersion` 2, `WalletSummary.user` gains `maskedPhone` and `email`, `listMovements` gains a `direction` filter and a cursor lookup by sort order.
- The wire types for the wallet in `src/shared/lib/api/views.ts`, shared by the server and the client.
- A `movements_error` read scenario, a shared read-scenario runner, and the `direction` query parameter on `GET /api/v1/wallet/movements`.
- A Home loader in `src/server/wallet/` that applies the read scenario to Server Component reads, and `getHomeLoader()` in the container.
- Formatting in `src/shared/lib/format/`: money, dates and date groups, and names.
- A minimal `apiClient` with the `ApiFailure` union (`api`, `network`, `unknown`), the wallet query options, a `QueryClient` factory and its provider.
- UI primitives: new `Icon` names, `Button` as a link, `Avatar`, `Skeleton`, `BottomSheet`, `SideNav` and `BlockErrorBoundary`.
- The private shell in `src/app/(private)/layout.tsx`: nothing extra on mobile, a 72 px icon rail at `lg` and a 240 px labeled sidebar at `xl`.
- The wallet feature in `src/features/wallet/`: hooks, header, balance card with the hide-balance eye, "Mi cuenta" bottom sheet, movement list grouped by date, movement filter, and the loading, empty and error states of each block.
- `LogoutButton` variants for the sidebar and the sheet.
- `src/app/(private)/error.tsx` and `src/app/global-error.tsx`.
- The real `/home` page, replacing the SPEC 05 placeholder.
- MSW handlers for the wallet endpoints, `renderWithProviders` with a `QueryClient`, and E2E for Home.
- A `home` message namespace and a "Home" section in `CLAUDE.md`.

**Out of scope (for future specs):**

- "Envío rápido" (favorites card in the desktop aside). It opens the wizard with a preselected recipient, which does not exist until SPEC 07 (user decision).
- A "Contactos" item in the side navigation, and "Mis contactos" and "Seguridad" in the "Mi cuenta" sheet. No spec builds a contacts or security page (user decision).
- "Cuenta Spin •••• 4821" on the balance card. A wallet has no account number in the domain (user decision).
- Movement rows linking to the receipt. `/transfers/[transferId]` lands in SPEC 08, which makes transfer rows clickable (user decision).
- `TimeoutError`, `AbortController`, `Idempotency-Key` and POST in the `apiClient` (SPEC 08).
- Home cache invalidation after a transfer (SPEC 08).
- The transfer wizard. "Enviar dinero" links to `/transfers/new/amount`, which answers `404` until SPEC 07.
- Swipe-down to close the bottom sheet. Esc, the backdrop and the close button cover it.
- A movement detail screen and a date-range filter.

## Data model

### Domain (`src/domain/`)

```ts
interface Movement {
  id: MovementId; userId: UserId; type: MovementType; direction: MovementDirection;
  amount: Money; counterpartyName?: string; merchantName?: string;
  counterpartyAccount?: RecipientAccount;
  transferId?: TransferId; createdAt: string;
}
```

- `counterpartyAccount` is new (user decision). It is set on `transfer_out` (the recipient's account) and on a P2P `transfer_in` (`{ type: "phone", phone: sender.phone }`). Cash deposits and QR payments have none.
- `maskPhone(phone: string): string` in `src/domain/user/mask.ts` returns `"55 •••• 5678"` for `"5512345678"`. The UI adds the `+52` prefix through a message.
- `validateMovementDirection(input: string): Result<MovementDirection, ValidationCode>` in `src/domain/wallet/validators.ts` accepts `debit` and `credit` and returns `DIRECTION_INVALID` for anything else.
- `DIRECTION_INVALID` is appended to `VALIDATION_CODES`, with the es-MX message "El filtro de movimientos no es válido.".

### Wire types (`src/shared/lib/api/views.ts`)

The shapes that cross the HTTP boundary move here, so the client can type responses without importing `@/server`. `src/server/services/views.ts` imports them and keeps the `to*View` mappers.

```ts
export interface AccountView { type: RecipientAccount["type"]; masked: string; bankName?: string }

export interface MovementView {
  id: MovementId; type: MovementType; direction: MovementDirection; amount: Money;
  counterpartyName?: string; merchantName?: string; counterpartyAccount?: AccountView;
  transferId?: TransferId; createdAt: string;
}

export interface WalletSummary {
  user: { id: UserId; fullName: string; maskedPhone: string; email: string };
  balance: Money;
}

export interface MovementsPage { items: MovementView[]; nextCursor: string | null }
```

`maskedPhone` and `email` are new (user decision). The greeting, the "Mi cuenta" sheet and the sidebar user block all read one summary. `ContactView` and `TransferView` stay in `src/server/services/views.ts` until SPEC 07 and 08 need them on the client.

### Server changes (`src/server/`)

- `db/schema.ts`: `SCHEMA_VERSION` becomes `2`. The existing regeneration rule recreates a v1 file from the seed.
- `db/seed.ts`: Mariana's `transfer_out` movements get Carlos's phone account and her `transfer_in` movements get Diego's phone account.
- `services/transfer-service.ts`: the debit movement stores `counterpartyAccount: recipient.account`, and the P2P credit movement stores the sender's phone.
- `services/wallet-service.ts`:
  - `getSummary` adds `maskedPhone: maskPhone(user.phone)` and `email`.
  - `listMovements(userId, { cursor?, limit?, direction? })` filters by `direction` before paginating.
  - The page starts at the first movement that sorts strictly after the cursor's `(createdAt, id)`, instead of looking the cursor item up by index. A cursor taken from another filter, or from a movement that no longer appears in the list, keeps working without duplicates or gaps.

### Read scenarios (`src/shared/lib/api/contract.ts`, `src/server/mock/`)

```ts
export const READ_SCENARIO = { OK: "ok", ERROR: "error", SLOW: "slow", MOVEMENTS_ERROR: "movements_error" } as const;
export const READ_RESOURCE = { SUMMARY: "summary", MOVEMENTS: "movements", CONTACTS: "contacts" } as const;
export const READ_OUTCOME = { OK: "ok", SLOW: "slow", ERROR: "error" } as const;
```

| Scenario | `summary` | `movements` | `contacts` |
| --- | --- | --- | --- |
| `ok` (and no cookie) | ok | ok | ok |
| `slow` | slow | slow | slow |
| `error` | error | error | error |
| `movements_error` | ok | error | ok |

- `readOutcome(scenario, resource): ReadOutcome` in `src/server/mock/scenarios.ts` is the pure table above, with an exhaustive `switch`.
- `runReadScenario<T>(outcome, { sleep, random }, onOk, onError)` in `src/server/mock/read-scenario.ts` waits and branches: `ok` waits `latencyMs(READ_LATENCY_MS)` then calls `onOk`; `slow` waits `SLOW_READ_MS` then calls `onOk`; `error` waits `latencyMs(READ_LATENCY_MS)` then calls `onError`.
- `src/server/http/handlers/read-scenario.ts` keeps `runWithReadScenario(ctx, deps, resource, onSuccess)` on top of it, so handlers and the Home loader share one implementation.
- `movements_error` exists so the design's partial error (balance visible, movements failed) can be shown live and in E2E (user decision).

### Movements endpoint (`GET /api/v1/wallet/movements`)

`?direction=debit|credit` is optional. Absent means every movement. Any other value answers `400` with `details.direction: ["DIRECTION_INVALID"]`. `cursor` and `limit` keep their SPEC 04 rules.

### Home loader (`src/server/wallet/home-loader.ts`)

```ts
interface HomeLoaderDependencies {
  services: Services; random: () => number; sleep: (ms: number) => Promise<void>;
  allowScenarioOverride: boolean; logger: Logger;
}
interface HomeLoadRequest { userId: UserId; requestId: string; scenarioCookie?: string }
interface HomeLoader {
  loadSummary(request: HomeLoadRequest): Promise<Result<WalletSummary, HomeLoadFailure>>;
  loadMovements(request: HomeLoadRequest & { direction?: MovementDirection }): Promise<Result<MovementsPage, HomeLoadFailure>>;
}
type HomeLoadFailure = { kind: typeof HOME_LOAD_FAILURE.UNAVAILABLE };
createHomeLoader(deps): HomeLoader
```

- Each call resolves the scenario with `resolveReadScenario(scenarioCookie, allowScenarioOverride)` and its resource's `readOutcome`, then runs the service through `runReadScenario`.
- A simulated `error` and a service error both become `unavailable`, logged once with `logger.warn("home_load", { resource, scenario, requestId })`. The input is never logged.
- `src/server/container.ts` gains `getHomeLoader()`, built once from `getServices()`, `Math.random`, the `setTimeout`-based `sleep`, `logger` and `getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE`.

### Formatting (`src/shared/lib/format/`)

Pure functions over `locale` and `timeZone` from `@/shared/i18n/config` (`es-MX`, `America/Mexico_City`). Labels such as "Hoy" come from messages, never from these functions.

| File | Function | Output |
| --- | --- | --- |
| `money.ts` | `formatMoney(money)` | `"$12,450.80"` |
| `money.ts` | `formatSignedMoney(money, direction)` | `"+$1,000.00"` for credit, `"−$350.00"` (U+2212) for debit |
| `money.ts` | `splitMoney(money)` | `{ whole: "$12,450", cents: ".80" }` for the balance's smaller cents |
| `date.ts` | `getDateGroup(iso, nowIso)` | `DateGroup` (below) |
| `date.ts` | `formatTime(iso)` | `"10:42"` |
| `date.ts` | `formatDayAndTime(iso)` | `"19 oct, 08:12"` |
| `date.ts` | `formatLongDate(iso)` | `"Miércoles 22 de octubre"` |
| `date.ts` | `formatMonthLabel(year, month, nowIso)` | `"Octubre"`, or `"Septiembre 2025"` when the year is not the current one |
| `name.ts` | `getInitials(fullName)` / `getFirstName(fullName)` | `"ML"` / `"Mariana"` |

```ts
export const DATE_GROUP_KIND = { TODAY: "today", YESTERDAY: "yesterday", THIS_WEEK: "this_week", MONTH: "month" } as const;
export type DateGroup =
  | { kind: typeof DATE_GROUP_KIND.TODAY }
  | { kind: typeof DATE_GROUP_KIND.YESTERDAY }
  | { kind: typeof DATE_GROUP_KIND.THIS_WEEK }
  | { kind: typeof DATE_GROUP_KIND.MONTH; year: number; month: number };
```

Days are calendar days in `America/Mexico_City`. `today` is day 0, `yesterday` day 1, `this_week` days 2 to 6, and anything older goes to its calendar month (user decision). `groupMovements(items, nowIso)` in the same file returns `{ group: DateGroup; items: MovementView[] }[]` in list order, merging consecutive items with an equal group.

### API client and queries (`src/shared/lib/api/`, `src/shared/lib/query/`)

```ts
export const API_FAILURE_KIND = { API: "api", NETWORK: "network", UNKNOWN: "unknown" } as const;
export type ApiFailure =
  | { kind: typeof API_FAILURE_KIND.API; status: number; code: ApiErrorCode; requestId: string;
      details?: Record<string, ValidationCode[]>; balance?: Money }
  | { kind: typeof API_FAILURE_KIND.NETWORK }
  | { kind: typeof API_FAILURE_KIND.UNKNOWN; status?: number; requestId?: string };

export class ApiFailureError extends Error { readonly failure: ApiFailure }

apiGet<T>(path: string, init?: { signal?: AbortSignal }): Promise<Result<T, ApiFailure>>
```

- `api-client.ts`: a `fetch` that throws becomes `network`. A non-2xx response with an `ApiErrorBody` becomes `api`. Any other non-2xx response, or a body that is not JSON, becomes `unknown` with the `x-request-id` header when present. Success bodies are trusted and not schema-validated (own API).
- SPEC 08 adds `timeout`, `AbortController` at 8 s, `Idempotency-Key` and `apiPost`. The union is exhaustive, so adding a member breaks every `switch` that must handle it.
- `wallet-queries.ts`:
  - `walletQueryKeys = { all: ["wallet"], summary: () => [...all, "summary"], movements: (filter) => [...all, "movements", filter] }`.
  - `walletSummaryQueryOptions()` and `movementsInfiniteQueryOptions(filter)` use `queryOptions` / `infiniteQueryOptions`, with `initialPageParam: null` and `getNextPageParam: (page) => page.nextCursor`.
  - `MOVEMENT_FILTER = { ALL: "all", DEBIT: "debit", CREDIT: "credit" }` and `parseMovementFilter(value: string | null)`, which maps anything unknown to `all`.
  - These options live in `shared` because SPEC 07 reads the balance from the same cache key, and features cannot import each other.
- `query/query-client.ts`: `makeQueryClient()` sets `staleTime: 30_000` and retries once only for `network` failures. An `api` failure (the server answered) is shown at once.
- `query/query-provider.tsx` (`"use client"`): one browser `QueryClient` per session. Its `QueryCache.onError` sends the browser to `/login` on `UNAUTHORIZED`, because the session expires after 30 minutes while the page stays open.

### Preferences (`src/shared/lib/preferences/balance-visibility.ts`)

`BALANCE_VISIBILITY_COOKIE = "smw_balance_hidden"`, value `"1"` when hidden and absent when visible (user decision). `isBalanceHidden(value)` parses it on the server. `writeBalanceHidden(hidden)` writes it from the browser with `Path=/`, `SameSite=Lax` and one year of `Max-Age`. It is not `HttpOnly` and holds no secret. It survives logout, because it is a device preference.

### Tokens (`src/app/globals.css`, SPEC 00 §14)

| CSS token | Value | Usage |
| --- | --- | --- |
| `--size-rail` / `--size-sidebar` | `72px` / `240px` | Side navigation at `lg` and from `xl` |
| `--size-aside-lg` / `--size-aside` | `320px` / `340px` | Home aside at `lg` and from `xl` |
| `--container-app` | `1040px` | Private content cap; Tailwind `max-w-app` |
| `--text-size-balance` / `--text-size-balance-cents` | `40px` / `22px` | Desktop balance; mobile uses `--text-size-2xl` / `--text-size-lg` |
| `--size-avatar-lg` | `48px` | Avatar in the "Mi cuenta" sheet |
| `--size-movement-icon` / `--size-movement-icon-lg` | `34px` / `40px` | Movement icon tile on mobile and from `lg` |
| `--size-movement-row` | `56px` | Movement row height from `lg` |
| `--size-sheet-item` | `52px` | Bottom sheet item height |
| `--size-state-icon` | `56px` | Empty and error state icon circle |
| `--size-icon-lg` / `--size-icon-xl` | `20px` / `26px` | Navigation and sheet icons, state icons |
| `--duration-shimmer` | `1.4s` | One skeleton shimmer cycle |
| `--shadow-card` | `0 1px 2px` ink-900 at 6 % + `0 8px 24px` purple at 8 % | White cards (balance on mobile, movements card) |
| `--shadow-balance` | `0 12px 32px` purple at 28 % | Desktop gradient balance card |

The shadows are written with `color-mix()` over the color tokens, like the existing SCSS. `_breakpoints.scss` gains `$xl: 1280px` and an `xl` mixin; Tailwind's default `xl` is already 1280 px. SPEC 00 §14 named the container `--container-content`; it becomes `--container-app`, as in the design. The design document says `--text-size-3xl: 40px`, but `3xl` is already 32 px in code (desktop auth title), so the balance gets its own token.

### UI primitives (`src/shared/ui/`)

| Component | Props | Behavior |
| --- | --- | --- |
| `Icon` | — | Gains `send`, `arrow-in`, `store`, `inbox`, `home`, `users` and `logout`, copied from the design's symbols, plus `ICON_SIZE.LG` / `XL` (`--size-icon-lg` / `-xl`) |
| `Button` | gains `href?: Route` | With `href` it renders a `next/link` with the same classes and no `type`, `loading` or `disabled`. The props are a union, so `href` and `loading` cannot be combined |
| `Avatar` | `initials`, `size: AvatarSize` (`md` 36 / `touch` 44 / `lg` 48), `tone: AvatarTone` (`on-brand` / `soft`) | A circle with initials, `aria-hidden` (the caller supplies the accessible name) |
| `Skeleton` | `shape: SkeletonShape` (`line`, `tile`, `circle`, `pill`), `size?: SkeletonSize`, `width?` (percentage) | Lavender shimmer over `--duration-shimmer`; static with `prefers-reduced-motion`. `aria-hidden` |
| `BottomSheet` | `open`, `onClose`, `label`, `children` | Native `<dialog>` opened with `showModal()`: focus is trapped and Esc closes it natively. A backdrop click and a close button call `onClose`. Focus returns to the trigger. Rounded top (`--radius-l`), handle bar and `safe-area-inset-bottom` padding |
| `SideNav` | `items: { href, label, icon }[]`, `user?: ReactNode`, `footer?: ReactNode`, `label` | Hidden below `lg`. At `lg`, a 72 px rail with icons only: the label stays in the DOM as the accessible name and shows as a tooltip on hover and focus. From `xl`, 240 px with logo and labels. Vertical purple gradient, 44 px items, the active item (by `usePathname`) gets `aria-current="page"` and an orange inset accent. `user` and `footer` are anchored at the bottom |
| `BlockErrorBoundary` | `title`, `retryLabel`, `children` | Built with `catchError` from `next/error`. Reports with `source: "browser"` and renders the title and a retry button that calls `retry()`. It catches unexpected render errors so one Home block failing never hides the other |

Each folder has its `types.ts` (`AVATAR_SIZE`, `AVATAR_TONE`, `SKELETON_SHAPE`, `SKELETON_SIZE`, …) and only consumes CSS variables. Texts always come from the caller.

### Private shell (`src/app/(private)/layout.tsx`)

- Below `lg`, no chrome: each page owns its header (Home's gradient header, SPEC 07's `AppBar`).
- From `lg`, a grid `lg:grid-cols-[var(--size-rail)_1fr] xl:grid-cols-[var(--size-sidebar)_1fr]`. The `SideNav` is sticky and full height, with "Inicio" (`/home`) and "Enviar dinero" (`/transfers/new/amount`).
- Its `user` slot is a `<Suspense>`-wrapped Server Component that reads `getServices().wallet.getSummary` directly, without the read scenario: navigation chrome is not the simulated wallet API. It shows the avatar, the name and `55 •••• 5678`, and renders nothing if the read fails.
- Its `footer` slot is `<LogoutButton variant={LOGOUT_BUTTON_VARIANT.NAV_ITEM} />`.
- The layout wraps its children in `QueryProvider`.

### Wallet feature (`src/features/wallet/`)

One folder per component, each with `.tsx`, `.test.tsx` and, when needed, `.module.scss` and `types.ts`.

| Path | Responsibility |
| --- | --- |
| `hooks/use-wallet-summary.ts` | `useQuery(walletSummaryQueryOptions())` |
| `hooks/use-movements.ts` | `useInfiniteQuery(movementsInfiniteQueryOptions(filter))` plus the flattened items |
| `hooks/use-movement-filter.ts` | Reads `?direction=` with `useSearchParams` and `parseMovementFilter`. Changing it calls `window.history.pushState`, so the URL updates without a server round trip, and reload and back keep the filter (user decision) |
| `components/home-header/` | Mobile: purple gradient, "Hola," and the full name, and a 44 px `Avatar` button labeled "Abrir mi cuenta" that opens the `AccountSheet`. From `lg`: no gradient and no avatar, an H1 "Hola, {firstName}" at `--text-size-2xl` and `formatLongDate(now)` below it. Loading renders `Skeleton`s with the same shape. On error it shows "Hola" without a name or avatar |
| `components/account-sheet/` | `BottomSheet` "Mi cuenta": a 48 px avatar, the name, "+52 {maskedPhone}" and the email, then the `logout` slot. Rendered only below `lg` |
| `components/balance-card/` | "Saldo disponible", the eye toggle (44 × 44 hit area, `aria-pressed`, labeled "Ocultar saldo" / "Mostrar saldo"), the amount from `splitMoney` in Montserrat 800 with `tabular-nums`, and the "Enviar dinero" primary `Button` with `href` and the `send` icon. Hidden shows "$ •••••" with an accessible name "Saldo oculto". Mobile: a white card overlapping the header with `--shadow-card`. From `lg`: the gradient card with `--shadow-balance`, sticky at `top: var(--space-8)`, inside the aside. Its loading and error states keep the card's size |
| `components/summary-error/` | Inside the balance card: "No pudimos cargar tu saldo", "Reintentar" (calls `refetch`) and "Referencia: {requestId}" when the failure has one |
| `components/movement-filter/` | `Segmented` "Todos / Enviados / Recibidos" (`all`, `debit`, `credit`), on every breakpoint, above the list (user decision) |
| `components/movement-row/` | Icon tile by type, the title, the detail, the date and the signed amount. Mobile: date and detail joined in one meta line. From `lg`: a 56 px grid row with columns Concepto / Fecha / Monto. Not interactive (SPEC 08 adds the link) |
| `components/movement-list/` | Groups by `groupMovements(items, now)`. Each group is a `<section>` labeled by its heading (`--text-size-xs`, uppercase), with a `<ul>` of rows. From `lg` it sits in a white card with the title, the filter and a column header row (`aria-hidden`). Renders the loading, empty, error, load-more and load-more-error states below |
| `components/movements-state/` | The centered state block (56 px icon circle, title, text, optional action and reference) shared by the empty and error states |
| `components/summary-skeleton/` and `components/movements-skeleton/` | The Suspense fallbacks, shaped like the content (5 rows by default) |

A movement's text is an exhaustive `switch` on `type` with `assertUnreachable`:

| `type` | Title | Detail |
| --- | --- | --- |
| `transfer_out` | "Envío a {name}" | `{accountType} {masked}`, e.g. "Celular •••• 5678" |
| `transfer_in` | "Recibido de {name}" | `{accountType} {masked}` when there is an account |
| `cash_deposit` | "Depósito en {merchant}" | "Efectivo" |
| `qr_payment` | "Pago con QR · {merchant}" | "Compra en tienda" |

`{accountType}` is an exhaustive `switch` on `RECIPIENT_ACCOUNT_TYPE` ("Celular", "CLABE", "Tarjeta"). A missing name or merchant uses the fallback title ("Envío de dinero", "Dinero recibido", "Depósito en efectivo", "Pago con QR"). The date is `formatTime` in the `today` and `yesterday` groups and `formatDayAndTime` in the others. Credits use `--color-success`, an `arrow-in` icon on `success-bg` and a `+` sign. Debits use ink, a `send` (transfer) or `store` (QR) icon on lavender and a `−` sign.

List states, as an exhaustive `switch` over the view the hook returns:

| State | When | UI |
| --- | --- | --- |
| Loading | No data yet (server prefetch failed, or the filter changed) | `MovementsSkeleton` under the title and filter, which stay usable |
| Error | First page failed | Danger state with the `alert` icon: "No pudimos cargar tus movimientos", "Tu saldo está actualizado. Intenta cargar la lista otra vez.", "Reintentar" (`refetch`), and the reference |
| Empty | No items, filter `all` | `inbox` state: "Aún no tienes movimientos", "Cuando envíes o recibas dinero, lo verás aquí." |
| Empty filtered | No items, filter `debit` or `credit` | "No hay movimientos de este tipo", "Prueba con otro filtro." |
| List | Items | The groups, then "Ver más movimientos" (secondary `Button`) while `hasNextPage` |
| Loading more | `isFetchingNextPage` | The button in `loading` ("Cargando…") plus 3 skeleton rows after the last group (user decision) |
| Load-more error | `isFetchNextPageError` | The loaded rows stay; a `danger` `Alert` "No pudimos cargar más movimientos." with "Reintentar" (`fetchNextPage`) and the reference |

### `LogoutButton` (`src/features/auth/components/logout-button/`)

Gains `variant: LogoutButtonVariant` in a new `types.ts`: `LOGOUT_BUTTON_VARIANT = { NAV_ITEM: "nav-item", MENU_ITEM: "menu-item" }`. `nav-item` matches the `SideNav` items (icon, label shown from `xl`, tooltip at `lg`). `menu-item` matches the sheet items, in danger color. Both keep `useFormStatus` pending and the `logout` icon. The `secondary` button form disappears with the placeholder.

### Pages and sections (`src/app/`)

| File | Rendering | Content |
| --- | --- | --- |
| `(private)/home/page.tsx` | Static shell + two `<Suspense>` | A grid: mobile areas `header` / `balance` / `movements`; from `lg`, `header header` / `movements aside` with `minmax(0,1fr) var(--size-aside-lg)`, `var(--size-aside)` from `xl`, capped at `max-w-app` with `lg:px-6 xl:px-8` gutters. Each block is inside its own `BlockErrorBoundary`. Metadata title "Inicio" |
| `(private)/home/_sections/summary-section.tsx` | Dynamic, inside `<Suspense fallback={<SummarySkeleton />}>` | `getSession()` (redirects to `/login` without one), the request id from `headers()`, the read-scenario and balance-visibility cookies from `cookies()`, `now`. Calls `getHomeLoader().loadSummary`. On success, `setQueryData(walletQueryKeys.summary(), …)`. Always renders `HydrationBoundary` with `HomeHeader` (with `AccountSheet` and a `menu-item` `LogoutButton` in its slot) and `BalanceCard` as two grid items |
| `(private)/home/_sections/movements-section.tsx` | Dynamic, inside `<Suspense fallback={<MovementsSkeleton />}>` | Same session and cookies, `parseMovementFilter` on the awaited `searchParams.direction`, then `loadMovements`. On success, `setQueryData(walletQueryKeys.movements(filter), { pages: [page], pageParams: [null] })`. Renders `HydrationBoundary` with `MovementList` and `now` |
| `(private)/error.tsx` | Client | Reports with `source: "browser"` and the `digest`. "Algo salió mal", "Ocurrió un error inesperado. Intenta de nuevo.", "Reintentar" (`retry`) and a "Volver al inicio" link |
| `global-error.tsx` | Client | Its own `<html lang="es-MX">` and `<body>`, `globals.css` and the fonts (moved from `layout.tsx` to `src/shared/styles/fonts.ts` so both import them), wrapped in `NextIntlClientProvider` with the `common` messages only. Same content as `error.tsx` |

A failed server load is not dehydrated, so the client query starts with no data and fetches through the API. Under `error` or `movements_error` that fetch fails too and the block shows its error state. After a transient failure it simply succeeds. `now` is captured on the server and passed down, so server and client group movements against the same instant and hydration cannot mismatch. `home.placeholder` and the placeholder's `page.module.scss` are deleted.

### Messages (`src/messages/es-MX/`)

`home.json` (namespace `home`) is rewritten:

| Key | es-MX |
| --- | --- |
| `home.metaTitle` | "Inicio" |
| `home.header.hello` / `greeting` / `openAccount` | "Hola," / "Hola, {name}" / "Abrir mi cuenta" |
| `home.account.title` / `phone` / `close` | "Mi cuenta" / "+52 {phone}" / "Cerrar" |
| `home.balance.label` / `show` / `hide` | "Saldo disponible" / "Mostrar saldo" / "Ocultar saldo" |
| `home.balance.hiddenAmount` / `hiddenLabel` | "$ •••••" / "Saldo oculto" |
| `home.balance.send` | "Enviar dinero" |
| `home.balance.error.title` / `retry` | "No pudimos cargar tu saldo" / "Reintentar" |
| `home.movements.title` | "Movimientos recientes" |
| `home.movements.filter.label` / `all` / `debit` / `credit` | "Filtrar movimientos" / "Todos" / "Enviados" / "Recibidos" |
| `home.movements.columns.concept` / `date` / `amount` | "Concepto" / "Fecha" / "Monto" |
| `home.movements.groups.today` / `yesterday` / `thisWeek` | "Hoy" / "Ayer" / "Esta semana" |
| `home.movements.titles.transferOut` / `transferIn` / `cashDeposit` / `qrPayment` | "Envío a {name}" / "Recibido de {name}" / "Depósito en {merchant}" / "Pago con QR · {merchant}" |
| `home.movements.fallbackTitles.transferOut` / `transferIn` / `cashDeposit` / `qrPayment` | "Envío de dinero" / "Dinero recibido" / "Depósito en efectivo" / "Pago con QR" |
| `home.movements.details.cash` / `store` | "Efectivo" / "Compra en tienda" |
| `home.movements.more` / `loadingMore` | "Ver más movimientos" / "Cargando…" |
| `home.movements.empty.title` / `text` | "Aún no tienes movimientos" / "Cuando envíes o recibas dinero, lo verás aquí." |
| `home.movements.emptyFiltered.title` / `text` | "No hay movimientos de este tipo" / "Prueba con otro filtro." |
| `home.movements.error.title` / `text` / `retry` | "No pudimos cargar tus movimientos" / "Tu saldo está actualizado. Intenta cargar la lista otra vez." / "Reintentar" |
| `home.movements.moreError` | "No pudimos cargar más movimientos." |

Added to `common.json`: `common.account.phone` / `clabe` / `card` ("Celular" / "CLABE" / "Tarjeta"), `common.reference` "Referencia: {requestId}", `common.nav.label` / `home` / `send` ("Navegación principal" / "Inicio" / "Enviar dinero"), `common.blockError.title` / `retry` ("No pudimos mostrar esta sección" / "Reintentar") and `common.errorPage.title` / `text` / `retry` / `home` ("Algo salió mal" / "Ocurrió un error inesperado. Intenta de nuevo." / "Reintentar" / "Volver al inicio").

`errors.json` gains `errors.validation.DIRECTION_INVALID`.

### Tests setup (`src/test/`)

- `render.tsx`: `renderWithProviders` also wraps a fresh `QueryClient` per call (`retry: false`, `gcTime: Infinity`) and accepts an optional `queryClient` to pre-seed data.
- `msw/handlers.ts`: default handlers for `GET /api/v1/wallet/summary` and `GET /api/v1/wallet/movements` (cursor and `direction` aware) over factories in `src/test/factories/wallet.ts`. Tests override them with `server.use` for errors, empty lists and network failures.
- `e2e/fixtures/scenario.ts`: `setReadScenario(context, value)` writes the `mock_read_scenario` cookie. `playwright.config.ts` sets `MOCK_ALLOW_SCENARIO_OVERRIDE=true` for its server.

## Implementation plan

Each step leaves lint, typecheck and tests green and is committed on its own. Before writing a step, read the relevant guide in `node_modules/next/dist/docs/` (`01-getting-started/08-caching.md`, `01-getting-started/10-error-handling.md`, `03-api-reference/03-file-conventions/error.md`, `04-functions/catchError.md`, `01-getting-started/04-linking-and-navigating.md` for the native History API, and `03-file-conventions/page.md` for `searchParams`).

1. **Branch and docs.** Pull `develop` and create `feature/06-home`. In SPEC 00, update §4 (the Home loader and the scenario on SSR), §8 (the summary's `maskedPhone` and `email`, the `direction` parameter, `counterpartyAccount` on movements), §9 (`movements_error` and the resource table), §12 (the minimal `apiClient` lands here, SPEC 08 extends it) and §14 (the new tokens, `--container-app`). In `challenge.md` §8.4, record the outcome of each SPEC 06 row. Link this spec from `roadmap.md` and mark 06 as in progress.
   - Why: other sessions read these files, not this chat.

2. **Dependency, tokens and breakpoint.** `npm install @tanstack/react-query@^5`. Add the token table above to `@theme static` and `$xl` with its mixin to `_breakpoints.scss`.
   - Why: every later step consumes them.

3. **Domain.** Add `counterpartyAccount` to `Movement`, `maskPhone` with tests (10 digits, spaces stripped), `validateMovementDirection` with tests, and `DIRECTION_INVALID` with its message.
   - Why: the server and the UI depend on these, under the 100 % domain gate.

4. **Wire types and services.** Create `src/shared/lib/api/views.ts` and point `src/server/services/views.ts` at it. Map `counterpartyAccount` through `toAccountView`. Bump `SCHEMA_VERSION`, update the seed, `TransferService` and `WalletService`. Tests: the summary has `maskedPhone` `"55 •••• 5678"` and Mariana's email; `direction: "credit"` returns only credits; a cursor from the unfiltered list used with `direction` returns the next older credits without duplicates; a transfer to a phone stores the account on both movements; a v1 file is regenerated.
   - Why: the data the Home shows, proven before any UI exists.

5. **Read scenarios and the movements filter.** Add `MOVEMENTS_ERROR`, `READ_RESOURCE` and `READ_OUTCOME` to `contract.ts`, `readOutcome` to `scenarios.ts` and `src/server/mock/read-scenario.ts`. Move the three read handlers onto it with their resource, and add `direction` to the movements handler. Tests: every cell of the scenario table including the `default` branch, `movements_error` failing movements and passing summary and contacts, `direction=credit`, and `direction=x` answering `400` `DIRECTION_INVALID`.
   - Why: the partial error becomes demonstrable, and handlers and the loader share one runner.

6. **Home loader.** Create `src/server/wallet/home-loader.ts` and `getHomeLoader()`, with tests against a temporary database and a fake `sleep`: `ok` waits inside the read range, `slow` waits 3000 ms, `error` and `movements_error` return `unavailable` where the table says so, the override is ignored when not allowed, a service `NOT_FOUND` becomes `unavailable`, and the warn log has the resource and request id and no user data.
   - Why: the SSR path honors the same scenarios as the API.

7. **Formatting.** Create `money.ts`, `date.ts` and `name.ts` with tests: positive, zero and large amounts, both signs, `splitMoney`; `getDateGroup` at 00:00 and 23:59 Mexico City time, day 6 versus day 7, a month of the previous year; `groupMovements` merging consecutive groups; `formatLongDate` capitalized; initials for one, two and three names.
   - Why: pure rules the list depends on, inside the 80 % `shared/lib` gate.

8. **API client and queries.** Create `api-client.ts`, `wallet-queries.ts`, `query-client.ts` and `query-provider.tsx`. Extend `renderWithProviders` and add the MSW handlers and factories. Tests: `200` returns `ok`; a `503` envelope becomes `api` with code and request id; a `500` with an HTML body becomes `unknown` with the header's request id; a rejected `fetch` becomes `network`; `parseMovementFilter` maps unknown values to `all`; the retry rule retries `network` once and never `api`; `UNAUTHORIZED` triggers the login redirect.
   - Why: the client contract every hook builds on, shared with SPEC 07 and 08.

9. **Icon, Button link, Avatar and Skeleton.** Add the icon names and sizes, `Button` with `href`, and the `avatar/` and `skeleton/` folders, with tests: each new icon renders, a `Button` with `href` is a link with the button classes, `Avatar` is `aria-hidden` with its size class, `Skeleton` is `aria-hidden` with its shape class.
   - Why: the pieces the header, the card and the skeletons share.

10. **BottomSheet, SideNav and BlockErrorBoundary.** Create the three folders with tests: the sheet calls `showModal` when `open`, `onClose` on Esc (`cancel` event), on a backdrop click and on the close button; the nav marks the current path with `aria-current="page"` and keeps each label as the link's accessible name; the boundary renders its fallback when a child throws, reports once and re-renders the children on retry. If jsdom lacks `HTMLDialogElement.showModal`, `src/test/setup.ts` adds a minimal stub.
    - Why: the shell and the sheet are built from these.

11. **Private shell and error pages.** Add `LOGOUT_BUTTON_VARIANT` to `LogoutButton` with tests, create `src/app/(private)/layout.tsx` with `SideNav`, the user slot and `QueryProvider`, move the fonts to `src/shared/styles/fonts.ts`, and create `(private)/error.tsx` and `global-error.tsx`. Manual check: at 1100 px the rail shows icons with tooltips, at 1280 px the sidebar shows labels, the placeholder page still renders inside.
    - Why: every private page from here on renders inside this shell.

12. **Summary block.** Create `use-wallet-summary.ts`, `home-header/`, `account-sheet/`, `balance-card/`, `summary-error/`, `summary-skeleton/` and `balance-visibility.ts`, with tests over MSW: the name and `$12,450.80` render from a seeded cache; the avatar button opens the sheet with the masked phone, the email and the logout slot; the eye toggles the amount, `aria-pressed` and the label and writes the cookie; `initialHidden` starts hidden; a `503` shows the error with "Reintentar" and the reference, and retrying refetches; "Enviar dinero" links to `/transfers/new/amount`.
    - Why: the balance and name half of PDF screen 2.

13. **Movements block.** Create `use-movements.ts`, `use-movement-filter.ts`, `movement-filter/`, `movement-row/`, `movement-list/`, `movements-state/` and `movements-skeleton/`, with tests over MSW: rows grouped under "Hoy", "Ayer", "Esta semana" and a month; each type's title and detail, including the fallback and the `default` branch with an invalid type; signs and the credit class; "Ver más" appends the next page and shows 3 skeleton rows while loading; it disappears without `nextCursor`; a failed next page keeps the rows and shows the inline alert; the first-page error, the empty and the filtered-empty states; choosing "Recibidos" pushes `?direction=credit` and requests the filtered list.
    - Why: the movements half of PDF screen 2, with every state the brief asks for.

14. **Home page.** Rewrite `(private)/home/page.tsx` with the grid, the two `_sections`, their Suspense fallbacks and `BlockErrorBoundary`s. Rewrite `home.json` and add the `common.json` keys. Delete `home.placeholder` and the placeholder's SCSS. Manual check with `npm run dev`: Mariana's Home on mobile and desktop widths, then each `mock_read_scenario` value by cookie.
    - Why: composes both blocks into the page the proxy already guards.

15. **E2E.** Add `e2e/fixtures/scenario.ts`, set `MOCK_ALLOW_SCENARIO_OVERRIDE=true` in `playwright.config.ts` and create `e2e/home.spec.ts`. Cover: Mariana's name and balance; 10 rows, then 20 and 25 after two "Ver más", after which the button is gone; "Recibidos" leaves only `+` amounts, sets `?direction=credit` and survives a reload; Diego's empty state; `movements_error` shows the balance and the movements error with "Referencia", and "Reintentar" loads the list after the cookie is cleared; `slow` shows the skeleton before the balance; hiding the balance survives a reload; on `mobile`, the avatar opens "Mi cuenta", Esc closes it and "Cerrar sesión" lands on `/login`; on `desktop`, the sidebar has "Inicio" with `aria-current="page"`, and at 1100 px the rail is shown with the labels visually hidden.
    - Why: proves streaming, hydration, pagination and the scenarios in a real browser on both projects.

16. **Docs.** Add a "Home" section to `CLAUDE.md`: the Home loader and the read scenario on SSR, `movements_error`, prefetch with `setQueryData` + `HydrationBoundary`, the wire types in `src/shared/lib/api/views.ts`, `apiClient` and `ApiFailure`, `walletQueryKeys` in `shared` for SPEC 07, the filter in the URL through the History API, the private shell and its slots, the new primitives, and the balance-visibility cookie. Update the "Server core" paragraph about which views may leave `src/server/`. Mark SPEC 06 as `Implemented` in `roadmap.md` once the criteria pass.
    - Why: SPEC 07 and 08 build on these conventions from other sessions.

## Acceptance criteria

- [x] `package.json` lists `@tanstack/react-query` 5.x under `dependencies`.
- [x] SPEC 00 §8, §9, §12 and §14 and `challenge.md` §8.4 describe the decisions of this spec.
- [x] `maskPhone("5512345678")` returns `"55 •••• 5678"` and `validateMovementDirection("x")` returns `DIRECTION_INVALID`, with 100 % coverage on `src/domain/**`.
- [x] `GET /api/v1/wallet/summary` for Mariana answers `user.maskedPhone: "55 •••• 5678"` and `user.email: "mariana@spin.test"`, and no response contains a full phone number.
- [x] `GET /api/v1/wallet/movements?direction=credit` returns only `credit` items, and `?direction=x` answers `400` with `details.direction: ["DIRECTION_INVALID"]`.
- [x] Every `transfer_out` movement in the seed has a `counterpartyAccount` whose `masked` value contains at most 4 digits.
- [x] Paginating with `direction=credit` from a cursor returns no item twice and skips none.
- [x] With `mock_read_scenario=movements_error`, the movements endpoint answers `503` and the summary and contacts endpoints answer `200`.
- [x] `getHomeLoader().loadMovements` under `movements_error` returns `unavailable`, and `loadSummary` under the same cookie returns the summary.
- [x] `getDateGroup` puts a movement from 00:05 Mexico City time today in `today` and one from 23:55 yesterday in `yesterday`, at any server time zone.
- [x] `apiGet` turns a rejected `fetch` into `{ kind: "network" }` and a `503` envelope into `{ kind: "api", code: "UPSTREAM_UNAVAILABLE", requestId }`.
- [x] `avatar`, `skeleton`, `bottom-sheet`, `side-nav` and `block-error-boundary` live in `src/shared/ui/` with `.tsx`, `.test.tsx`, `.module.scss` where they have styles and `types.ts` where they declare constants, and no SCSS file has a hex value or a loose measured value.
- [x] `/home` for Mariana shows her name, "$12,450.80" and 10 movements under date-group headings, and "Ver más movimientos" loads 10 more each time until 25, when it disappears.
- [x] While the next page loads, the button is in `loading` and 3 skeleton rows follow the list.
- [x] Choosing "Recibidos" changes the URL to `?direction=credit` without a full page load, every visible amount starts with `+`, and a reload keeps "Recibidos" selected.
- [x] `/home` for Diego shows "$500.00" and "Aún no tienes movimientos".
- [x] With `mock_read_scenario=slow`, the Home skeleton is visible before the balance appears.
- [x] With `mock_read_scenario=movements_error`, the balance stays visible and the movements block shows "No pudimos cargar tus movimientos", "Reintentar" and "Referencia: …".
- [x] With `mock_read_scenario=error`, both blocks show their own error state and the page does not fall into `error.tsx`.
- [x] Hiding the balance replaces the amount with "$ •••••", sets `aria-pressed="true"`, and survives a reload with no visible flash of the amount.
- [x] Credits show a `+` sign and debits a `−` sign, so color never carries the meaning alone.
- [x] Below 1024 px, the avatar is a 44 × 44 button that opens a modal "Mi cuenta" dialog with the masked phone and email, Esc closes it and returns focus to the avatar, and "Cerrar sesión" inside it lands on `/login`.
- [x] From 1024 to 1279 px the navigation is a 72 px icon rail; from 1280 px it is a 240 px sidebar with labels; in both, "Inicio" has `aria-current="page"` on `/home`.
- [x] From 1024 px, the balance card sits in the aside (320 px at `lg`, 340 px from `xl`) and stays visible while the page scrolls, and the content never exceeds 1040 px.
- [x] "Enviar dinero" is the only orange element on Home and links to `/transfers/new/amount`.
- [x] No text on Home is smaller than 12 px.
- [x] An error thrown while rendering one Home block leaves the other block visible.
- [x] `npm run test:e2e` passes on the `mobile` and `desktop` projects.
- [x] `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100 % on `src/domain/**`, 80 % on `src/server/**`, `src/shared/lib/**` and `src/shared/observability/**`) and `npm run build` finish with no errors.
- [x] No component or page contains user-facing text outside `src/messages/es-MX/`.
- [x] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** the server prefetches both blocks and hydrates TanStack Query (user decision). The first paint has real data, and SPEC 07 reads the balance from the same cache key, as SPEC 00 §4 says.
- **No:** the balance as a plain Server Component. SPEC 07 would have to fetch the balance again on its own.
- **No:** fetching everything on the client. It always shows a skeleton first and contradicts SPEC 00 §4.
- **Yes:** the Server Component path honors `mock_read_scenario` through a Home loader (user decision). The skeleton and the error states can be shown on the first load, which is what the evaluator sees.
- **No:** applying the scenario only to the API. The first load would never show the states the brief asks for.
- **Yes:** a failed server load is simply not dehydrated, and the client query fetches by itself. One error UI per block, driven by the query, covers both the SSR and the client failures.
- **Yes:** `now` captured on the server and passed to the client. Grouping by "Hoy" and "Ayer" cannot differ between server and client around midnight.
- **Yes:** a minimal `apiClient` and `ApiFailure` now, extended in SPEC 08 (user decision). "Ver más" and "Reintentar" need them, and building a throwaway fetcher would be migrated later anyway.
- **Yes:** the wallet query keys and options in `src/shared/lib/api/`. SPEC 07's transfers feature needs the same summary key, and features cannot import each other.
- **Yes:** the wire types move to `src/shared/lib/api/views.ts`. Client code cannot import `@/server`, and one definition keeps both sides from drifting, as with SPEC 04's contract.
- **Yes:** movements store the counterparty account, and the row shows it masked (user decision). It follows the approved mobile review and the desktop proposal.
- **Yes:** `SCHEMA_VERSION` 2. The existing rule regenerates old local files from the seed, so the new field shows up without manual steps.
- **Yes:** the summary carries `maskedPhone` and `email` (user decision). One read feeds the greeting, the sheet and the sidebar, and the full phone never leaves the server.
- **Yes:** "Ver más" shows a loading button and 3 skeleton rows; a failed page keeps the loaded rows (user decision). The list does not jump and nothing already read disappears.
- **Yes:** the hide-balance eye, persisted in a cookie the server reads (user decision). The preference survives a reload with no flash of the amount.
- **No:** keeping the preference in memory only, or in `localStorage`. The first loses it on reload; the second can only apply after hydration, which flashes the balance.
- **Yes:** groups "Hoy", "Ayer", "Esta semana" and then one per month, on every breakpoint (user decision). The seed spans 30 days, and one rule keeps mobile and desktop consistent.
- **Yes:** the "Todos / Enviados / Recibidos" filter on every breakpoint, server-side through `direction`, with its state in the URL (user decision). Filtering only the loaded pages would hide older matches; the URL keeps it across reloads and back.
- **Yes:** the URL changes through `window.history.pushState`, which Next syncs with `useSearchParams`. Changing the filter costs one API call and no server render.
- **Yes:** "Enviados" and "Recibidos" map to `debit` and `credit`, with the design's labels. A QR payment counts as "Enviados", and a cash deposit as "Recibidos".
- **No:** "Envío rápido", the "Contactos" navigation item and "Cuenta Spin •••• 4821" (user decision). The first needs the SPEC 07 wizard, the second a page no spec builds, the third an account number the domain does not have.
- **No:** "Mis contactos" and "Seguridad" in the sheet. Only the user data and "Cerrar sesión" have somewhere to go.
- **No:** movement rows linking to the receipt yet (user decision). The receipt is SPEC 08, and a link to a `404` promises something that does not exist.
- **Yes:** a `movements_error` read scenario (user decision). The design's partial error (balance visible, movements failed) can be shown live and tested.
- **No:** one scenario cookie per resource. More cookies and more surface for one demo case.
- **Yes:** the read-scenario runner is shared by the Route Handlers and the Home loader. One implementation of the latency and failure rules.
- **Yes:** the sidebar user block reads the summary directly, without the scenario. Navigation chrome is not the simulated wallet API, and failing it would only add noise to the demo.
- **Yes:** `error.tsx` for the private segment and `global-error.tsx` (user decision). Unexpected errors get a recoverable screen and reach the reporter; expected ones stay inside each block.
- **Yes:** per-block `BlockErrorBoundary` built with `catchError`. SPEC 00 §12 requires that one block failing never hides the other, and `catchError` lets `redirect()` pass through.
- **Yes:** `BottomSheet` on a native `<dialog>` with `showModal()`. Focus trapping, Esc and the top layer come from the browser, with no focus-trap code.
- **No:** swipe-down to close. Esc, the backdrop and the close button cover it, and gesture code adds risk for little gain.
- **Yes:** the shell takes logout through slots, and `LogoutButton` gains two variants. The wallet feature and `shared/ui` cannot import the auth feature, so `app/` composes them.
- **Yes:** `Button` accepts `href`. "Enviar dinero" is navigation, so it is a link that looks like the primary button, not a button that navigates.
- **Yes:** the movements cursor is located by sort order, not by index. A cursor from another filter, or one whose movement moved, cannot restart the list.
- **Yes:** `--container-app` and `--text-size-balance` instead of the design's `--container-content` and `--text-size-3xl: 40px`. The first matches the design document's own name; the second avoids redefining a token already used at 32 px.
- **Yes:** the TanStack client retries once only on `network` failures. A server answer (`503` included) is shown at once, so "Reintentar" is the user's choice.
- **Yes:** `UNAUTHORIZED` from any query sends the browser to `/login`. The 30-minute session can expire while Home stays open.

## Risks

| Risk | Mitigation |
| --- | --- |
| Reading `cookies()`, `headers()` or `searchParams` outside `<Suspense>` breaks prerendering with Cache Components | Both sections and the sidebar user block sit inside `<Suspense>`; `npm run build` is an acceptance criterion |
| Server and client compute different date groups or different "now" | `now` is captured once on the server and passed as a prop; `getDateGroup` takes it as an argument |
| `useSearchParams` and `history.pushState` drift from the server's `searchParams` on back and forward | The filter is read only through `useMovementFilter`, which reads `useSearchParams`; the E2E reloads and checks the selection |
| A hydrated query and the client both fetch the first page | `setQueryData` plus a 30 s `staleTime` keep the hydrated page fresh on mount; a hook test checks that MSW receives no first-page request when the cache is seeded |
| jsdom does not implement `HTMLDialogElement.showModal` | A minimal stub in `src/test/setup.ts`; the real behavior is covered by the `mobile` E2E |
| The `slow` scenario makes the E2E flaky | It waits for the skeleton first and then for the balance, with Playwright's auto-wait instead of fixed sleeps |
| The `schemaVersion` bump wipes accounts registered in a local `.data/db.json` | Expected for a mock database; documented in the SPEC 09 README. The E2E database is recreated on every run anyway |
| The 12 px minimum is broken by copying the design's 10.5–11.5 px sizes | Group headings, meta and references use `--text-size-xs` (12 px) as the mobile review requires |

## What is **not** in this spec

- "Envío rápido", the "Contactos" item, "Mis contactos" and "Seguridad", and "Cuenta Spin •••• 4821".
- Movement rows linking to the receipt (SPEC 08).
- `TimeoutError`, `AbortController`, `Idempotency-Key` and POST in the `apiClient` (SPEC 08).
- Home cache invalidation after a transfer (SPEC 08).
- The transfer wizard (SPEC 07).
- Swipe-down to close the sheet, a movement detail screen and a date-range filter.

Each of them lands in the milestone listed in `specs/roadmap.md`, or stays out of the project.
