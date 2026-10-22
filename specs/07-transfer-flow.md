# SPEC 07 — New transfer flow: amount, recipient and review

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 02, SPEC 03, SPEC 04, SPEC 05, SPEC 06
> **Date:** 2026-10-22
> **Objective:** Build PDF screen 3 up to just before confirming: a three-step `amount` → `recipient` → `review` wizard with a persisted client draft, a favorites list, new contacts saved on the server, and the three business rules applied on the client.

**Branch:** `feature/07-transfer-flow` (branched from an up-to-date `develop`, merged back through a PR to `develop`).

## Why this spec exists

SPEC 06 left "Enviar dinero" pointing at `/transfers/new/amount`, which answers `404`. This milestone builds the wizard behind it. SPEC 08 then plugs the confirmation and the five outcomes into the review step this spec leaves ready.

Three findings shaped the decisions below:

- `ContactService.create` ignores `saveAsFavorite` and always stores `isFavorite: true`.
- A `{ kind: "new" }` recipient in the draft would keep a full CLABE or card number in `sessionStorage`. SPEC 00 §6 says full account numbers never reach the client.
- The design only draws part of the wizard: mobile steps 1 and 2, the original mobile 2b, the original review and the desktop step 2. Desktop steps 1 and 3, the desktop 2b, and the loading, empty and error states have no drawing.

So every new recipient is saved on the server first, and the draft keeps only its id and masked view (user decision).

Scope was trimmed on 2026-10-22 to fit the deadline (user decision). The recipient step shows only the favorites list, with no "Recientes" row and no search. The screens the design does not draw are built from the patterns it already has (see "Design reference" below), with no separate design pass.

## Scope

**In:**

- SPEC 00 §4, §5, §8, §12 and §14, `challenge.md` §8.4 and `roadmap.md` updated with the decisions below.
- `zustand` as a dependency.
- Wizard tokens, and the `plus` icon.
- Domain: `validateTransferAmount`, which `validateTransfer` reuses, and the `TRANSFER_FEE` constant.
- Server: `ContactService.create` respects `saveAsFavorite`, rejects the user's own phone and reports whether it created the contact. `ContactView` moves to `src/shared/lib/api/views.ts`.
- `POST /api/v1/contacts` answers `201` when it creates a contact, `200` when it returns an existing one, and `400 RECIPIENT_IS_SELF`. `GET /api/v1/contacts` does not change: it returns the favorites.
- `apiPost` in the `apiClient`, with no timeout. SPEC 08 adds the timeout, `AbortController` and `Idempotency-Key`.
- Transfer routes in `ROUTES`, replacing the `"/transfers/new/amount" as Route` literals.
- A Zustand draft persisted to `sessionStorage`, scoped to its owner, cleared on logout, with step guards.
- UI primitives: `Chip`, `Checkbox`, `SummaryList`, `ProgressSteps`, `Stepper`, and an optional step counter on `AppBar`.
- The transfers feature in `src/features/transfers/`: wizard shell, amount step, recipient step, new-recipient form, review step and live summary.
- The three pages under `src/app/(private)/transfers/new/` and their shared layout.
- A `transfers` message namespace, MSW handlers for contacts, E2E for the wizard, and a "Transfer wizard" section in `CLAUDE.md`.

**Out of scope (for future specs):**

- Sending the transfer: `useCreateTransfer`, `Idempotency-Key` on the request, `AbortController` at 8 s, the "Procesando" dialog and the five outcome screens (SPEC 08). "Confirmar envío" is rendered and disabled here.
- The receipt at `/transfers/[transferId]`, Home cache invalidation and clearing the draft after a success (SPEC 08).
- The DEV scenario panel (SPEC 08).
- The "Recientes" row and contact search from the mobile review and the desktop proposal (user decision, scope trim).
- A `/design` pass for the screens the design does not draw (user decision, scope trim). They follow the existing patterns listed in "Design reference".
- "Envío rápido" in the Home aside, and a preselected recipient through the URL.
- Editing, deleting or un-favoriting a contact, and a contacts page (SPEC 00 §2).
- A custom on-screen numeric keypad. The mobile review's keypad is the native keyboard opened by `inputMode="decimal"`.
- Swipe gestures between steps.

## Data model

### Domain (`src/domain/transfer/`)

```ts
export function validateTransferAmount(
  amount: Money,
  availableBalance: Money,
): Result<Money, TransferRuleViolation[]>;

export const TRANSFER_FEE: Money;
```

- `validateTransferAmount` holds rules 1 and 2 (`AMOUNT_NOT_POSITIVE`, then `INSUFFICIENT_FUNDS`). `validateTransfer` calls it and adds rule 3, so the amount step and the server share one implementation and the result of `validateTransfer` does not change.
- `TRANSFER_FEE` lives in `src/domain/transfer/fees.ts` and is `toMoney(0)`. The review shows it as "Comisión $0.00" (user decision). Fee rules stay out of scope (SPEC 00 §2).
- No new validation codes. The steps reuse `AMOUNT_*`, `INSUFFICIENT_FUNDS`, `RECIPIENT_REQUIRED`, `RECIPIENT_IS_SELF`, `NAME_*`, `PHONE_*`, `CLABE_*`, `CARD_*` and `CONCEPT_*`.

### Wire types (`src/shared/lib/api/views.ts`)

```ts
export interface ContactView { id: ContactId; name: string; account: AccountView; isFavorite: boolean }

export interface ContactsList { items: ContactView[] }
```

`ContactView` moves here unchanged from `src/server/services/views.ts`, which re-exports it, as SPEC 06 did with the wallet views. The client needs it to type the contacts list and the draft recipient.

### Server changes (`src/server/`)

```ts
interface ContactService {
  listFavorites(userId: UserId): Promise<ContactView[]>;
  create(
    userId: UserId,
    input: z.infer<typeof newContactSchema>,
  ): Promise<Result<{ contact: ContactView; created: boolean }, ServiceError>>;
}
```

- `listFavorites` does not change.
- `create` runs inside one `transaction`:
  - A phone account equal to the user's own phone returns `VALIDATION_ERROR` with `details.account: ["RECIPIENT_IS_SELF"]`, the same check `TransferService` already makes.
  - When a contact with the same account exists, it is returned with `created: false`. If `saveAsFavorite` is `true` and the contact is not a favorite yet, it becomes one. A favorite is never downgraded, and the stored name is kept.
  - Otherwise a contact is inserted with `isFavorite: input.saveAsFavorite` and returned with `created: true`.
- `SCHEMA_VERSION` does not change: `isFavorite` already exists on every stored contact.
- `create-contact-handler.ts` maps a failure through `toApiError` and answers `201` when `created` and `200` otherwise, with the `ContactView` as the body.

### API contract (SPEC 00 §8)

| Method and route | Success |
| --- | --- |
| `GET /api/v1/contacts` | Unchanged: `200 { items: ContactView[] }`, the favorites sorted by name |
| `POST /api/v1/contacts` | `201 ContactView` when created, `200 ContactView` when the account already existed; `400` with `details.account: ["RECIPIENT_IS_SELF"]` for the user's own phone |

### API client (`src/shared/lib/api/api-client.ts`)

```ts
apiPost<T>(path: string, body: unknown, init?: { signal?: AbortSignal }): Promise<Result<T, ApiFailure>>
```

- It sends `Content-Type: application/json` and `credentials: "same-origin"`. The browser adds `Origin`, which satisfies SPEC 04's CSRF check.
- It maps failures exactly like `apiGet`. Both share one private `toResult(response)` function.
- `ApiFailure` does not change. SPEC 08 adds `timeout`, the 8 s `AbortController` and the `Idempotency-Key` header.

### Routes (`src/shared/lib/routes.ts`)

```ts
export const ROUTES = {
  ROOT: "/", LOGIN: "/login", REGISTER: "/register", HOME: "/home", TRANSFERS: "/transfers",
  TRANSFER_AMOUNT: "/transfers/new/amount",
  TRANSFER_RECIPIENT: "/transfers/new/recipient",
  TRANSFER_REVIEW: "/transfers/new/review",
} as const;
```

`balance-card.tsx` and `(private)/layout.tsx` use `ROUTES.TRANSFER_AMOUNT` instead of their literals. `resolveRouteAccess` does not change: `/transfers/**` is already private.

### Transfer draft (`src/features/transfers/draft/`)

```ts
export const TRANSFER_STEP = { AMOUNT: "amount", RECIPIENT: "recipient", REVIEW: "review" } as const;
export type TransferStep = (typeof TRANSFER_STEP)[keyof typeof TRANSFER_STEP];

export interface DraftRecipient { contactId: ContactId; name: string; account: AccountView }

export interface TransferDraftState {
  ownerId: UserId | null;
  amountInCents: Cents | null;
  concept: string;
  recipient: DraftRecipient | null;
  idempotencyKey: string | null;
}

interface TransferDraftActions {
  claim(ownerId: UserId): void;
  setAmount(amountInCents: Cents, concept: string): void;
  setRecipient(recipient: DraftRecipient): void;
  ensureIdempotencyKey(): string;
  reset(): void;
}
```

- `draft-store.ts` creates the store with `zustand`'s `create` and the `persist` middleware over `createJSONStorage(() => sessionStorage)`, under `SESSION_STORAGE_KEY.TRANSFER_DRAFT` (`"smw.transfer-draft"`) with `version: 1`. A stored draft with another version is dropped, not migrated.
- `skipHydration: true`: the store starts empty on the server and on the first client render. `useDraftHydration()` calls `persist.rehydrate()` once in an effect and returns `hydrated`. Server and client render the same markup, and guards never run on an empty pre-hydration draft.
- The draft holds only masked data. `recipient` is a copy of the chosen `ContactView`'s `id`, `name` and `account` (user decision).
- `claim(ownerId)` resets the draft when its `ownerId` is set and differs from the session user, then stores the new owner. The wizard shell calls it with `summary.user.id`, so a draft left by another account in the same tab is never shown.
- `setAmount` and `setRecipient` clear `idempotencyKey` when the value changes. `ensureIdempotencyKey()` returns the stored key or stores a new `crypto.randomUUID()`. The review step calls it on mount, so the key is created when entering `/transfers/new/review` (SPEC 00 §9). Editing the payload never reuses a key, which would answer `409 IDEMPOTENCY_CONFLICT` in SPEC 08.
- The draft survives a reload, going back to Home and coming back through "Enviar dinero" (user decision). It is cleared on logout, on an owner mismatch, by "Cancelar" in the wizard, and after a successful transfer (SPEC 08).

```ts
export function resolveStepAccess(step: TransferStep, draft: TransferDraftState): TransferStep;
```

- `step-guard.ts` is a pure function that returns the step the user may see. `amount` is always allowed. `recipient` needs `amountInCents`. `review` needs `amountInCents` and `recipient`. Otherwise it returns the first incomplete step. It is an exhaustive `switch` on `TransferStep` with `assertUnreachable`.
- `useStepGuard(step)` waits for `hydrated` and calls `router.replace` when `resolveStepAccess` returns another step. Until then the step renders its skeleton.

### Client session storage (`src/shared/lib/session-storage/client-session.ts`)

```ts
export const SESSION_STORAGE_KEY = { TRANSFER_DRAFT: "smw.transfer-draft" } as const;
export function clearClientSession(): void;
```

- `clearClientSession` removes every `SESSION_STORAGE_KEY` value inside `try`/`catch`, because storage can throw in private mode.
- `LogoutButton` calls it in its form's `onSubmit`, before the Server Action runs. The `QueryProvider`'s `UNAUTHORIZED` redirect calls it too. The key lives in `shared` because the auth feature cannot import the transfers feature.

### Contacts queries (`src/features/transfers/api/`)

- `contact-queries.ts`: `contactQueryKeys = { all: ["contacts"], list: () => [...all, "list"] }` and `contactsQueryOptions()` over `apiGet<ContactsList>("/api/v1/contacts")`. They stay in the feature, because only the wizard reads contacts.
- `use-create-contact.ts`: `useMutation` over `apiPost<ContactView>("/api/v1/contacts", input)`. On success, when the returned contact is a favorite, it writes it into the cached list in name order, replacing an item with the same `id`. It does not retry.
- The wizard reads the balance with `useQuery(walletSummaryQueryOptions())` from `src/shared/lib/api/wallet-queries.ts`, the key SPEC 06 shares for this purpose. Coming from Home, it is already cached.

### Client rules per step

| Step | Check | Source |
| --- | --- | --- |
| Amount | Format, at most 2 decimals, maximum | `parseAmount` (`AMOUNT_*`) |
| Amount | Rules 1 and 2 against the cached balance | `validateTransferAmount` |
| Amount | Concept at most 40 characters | `validateConcept` |
| Recipient | Rule 3 when "Continuar" is pressed with no selection | `RECIPIENT_REQUIRED` |
| New recipient | Name, and phone, CLABE or card by type | `newContactSchema` |
| Review | All three rules again, against the current balance | `validateTransfer` |

Each step's form uses React Hook Form with `zodResolver` over a schema built from these domain functions, as in SPEC 05. The amount schema is `createAmountStepSchema(balance)`, because rule 2 needs the balance. "Continuar" is always enabled (mobile review). Pressing it, or Enter, runs the schema and shows the errors inline.

### Amount input (`src/features/transfers/components/amount-input/`)

- A text input with `inputMode="decimal"` and `autoComplete="off"`. It accepts digits and one `.`, with at most two decimals, and ignores any other key (user decision).
- `formatAmountInput(raw)` in `src/shared/lib/format/amount-input.ts` adds thousands separators to the integer part as the user types (`"12450.8"` → `"12,450.8"`). `parseAmount` converts the text to `Cents` on submit. No `number` or `float` ever holds the amount.
- The value is drawn large and centered in Montserrat 800 with `tabular-nums`. The `$` is a visual prefix. The input keeps a visible label "¿Cuánto quieres enviar?".
- The chips `$100`, `$200` and `$500` replace the amount. "Todo" sets the whole available balance and is disabled while the balance is not loaded.

### Recipient step

- "Tus favoritos": the favorites from `GET /contacts` as 64 px rows (`Avatar`, name, "{accountType} •••• 1234", radio). They are native radios in a labeled `radiogroup`, so arrow keys move the selection.
- "Agregar nuevo destinatario" is the first row on mobile and the last on desktop, as each design draws it.
- Selecting a favorite marks it. On mobile, "Continuar" becomes "Continuar con {firstName}". Submitting stores the recipient and goes to `review`.
- `?mode=new` shows the new-recipient form on the same route (user decision). It is opened and closed with `window.history.pushState`, like the Home filter. The browser's back button and the `AppBar` back link both return to the list. On desktop the form replaces the list inside the same card.

Contact list states, as an exhaustive `switch`:

| State | When | UI |
| --- | --- | --- |
| Loading | Contacts not loaded | 3 skeleton rows shaped like the list |
| Error | `GET /contacts` failed | `wizard-state` with "No pudimos cargar tus contactos", "Reintentar" and the reference; "Agregar nuevo destinatario" stays usable |
| Empty | No favorites (Diego) | `wizard-state` with "Aún no tienes contactos guardados", "Agrega a alguien para enviarle dinero." and "Agregar nuevo destinatario" as a secondary button |
| List | Favorites | The rows and the "Agregar nuevo destinatario" row |

### New-recipient form (`src/features/transfers/components/new-recipient-form/`)

- `Segmented` "Celular / CLABE / Tarjeta", the recipient's name, then the account field for that type:
  - phone with the `+52` prefix and `inputMode="tel"`;
  - CLABE with `inputMode="numeric"` and a "Banco detectado: {bank}" hint from `detectBank` once 3 digits are typed;
  - card with `inputMode="numeric"`.
- A `Checkbox` "Guardar en favoritos", checked by default.
- "Continuar" calls `useCreateContact`. On success the returned `ContactView` becomes the draft recipient and the wizard goes to `review`. While pending, the button is in `loading`.
- A `400` with field details puts each code on its field through `setError`. `RECIPIENT_IS_SELF` lands on the account field. Any other failure shows a `danger` `Alert` "No pudimos guardar el contacto." with "Reintentar" and the reference, and keeps the typed values.
- A contact saved without "Guardar en favoritos" is still the draft recipient, but it is not listed among the favorites.

### Review step and live summary

- `SummaryList` rows: "Para", "Cuenta" (`{accountType} •••• 1234` plus the bank when there is one), "Concepto" (only when not empty), "Comisión" (`TRANSFER_FEE`) and "Saldo después" (balance minus amount minus fee). The amount is drawn above the rows as "Vas a enviar".
- On mount it runs `validateTransfer` against the current balance. If a rule fails (the balance changed in another tab, for example), a `danger` `Alert` explains it with a link to the step that fixes it, and "Confirmar envío" stays disabled.
- "Confirmar envío" is the primary button. `ReviewStep` takes `onConfirm?: (draft: ValidTransferDraft) => void`. The page does not pass it in this milestone, so the button is disabled and an `info` `Alert` reads "Pronto podrás confirmar tu envío desde aquí." (user decision). SPEC 08 passes `useCreateTransfer` and deletes the note.
- "Editar datos" (ghost) goes to the amount step with the draft intact (user decision).
- From `lg`, the 340 px sticky live summary beside the 560 px card shows the amount and "Saldo después" in step 1, and adds "Para" and "Cuenta" in step 2. Its last row is the `info` note "Revisarás todo antes de confirmar.", as drawn.
- In step 3 on desktop, the review fills the 560 px card and the live summary is not rendered. The design says the summary "becomes the review", so its rows appear once, in the card, instead of twice.

### Wizard shell (`src/features/transfers/components/wizard-shell/`)

| Breakpoint | Chrome |
| --- | --- |
| Below `lg` | `AppBar` with the step title ("Enviar dinero", "¿A quién le envías?", "Nuevo destinatario", "Revisa tu envío"), the "1 de 3" counter and the back link to the previous step (Home from step 1); `ProgressSteps` below it; the step's CTA in `ActionBar` |
| From `lg` | A "Inicio" back link, the H1 "Enviar dinero", the `Stepper` (Monto, Destinatario, Revisión), and a grid of the 560 px card and the 340 px sticky summary, inside `max-w-app`. The card's footer has "Atrás" (ghost, left) and the CTA (right, min 200 px) |

- The shell is a Client Component. It reads the step from `usePathname`, calls `claim` with the summary's user id, and renders the step skeleton until the draft is hydrated.
- Completed steps in the `Stepper` are links. The current step has `aria-current="step"`.
- "Cancelar" (a ghost link in the shell) calls `reset()` and goes to Home.
- On every step change, focus moves to the step heading, which has `tabIndex={-1}`.
- The step content enters with an 8 px slide and fade over `--duration-fast`. Under `prefers-reduced-motion` it does not animate.
- If the balance fails to load, the amount step shows a `danger` `Alert` "No pudimos cargar tu saldo" with "Reintentar" and the reference instead of "Disponible". "Continuar" reports that the balance is needed (user decision). The live summary hides "Saldo después".

### Design reference

The design draws mobile steps 1 and 2 (mobile review), the original mobile 2b and review, and the desktop step 2. The rest is built from those drawings and from existing components, with no new visual language (user decision):

| Screen or state | Built from |
| --- | --- |
| Desktop step 1 | The desktop step 2 frame (card, footer, stepper, live summary) with the mobile-review amount content inside the card |
| Desktop step 2b | The same card with the mobile 2b form and the desktop footer |
| Desktop step 3 | The same card with the mobile review content and the desktop footer ("Editar datos" ghost on the left, "Confirmar envío" on the right); no live summary |
| Mobile 2b | The original 2b drawing, with the CTA moved into `ActionBar` and 44 px touch targets (mobile review rules) |
| Contacts loading, error and empty | Home's `movements-state` and `movements-skeleton` patterns |
| Balance unavailable, save error, review rule failure | The `danger` `Alert` with "Reintentar" and the reference, as in Home's load-more error |
| Disabled "Confirmar envío" | The `Button` disabled state plus an `info` `Alert` above it |

### UI primitives (`src/shared/ui/`)

| Component | Props | Behavior |
| --- | --- | --- |
| `Icon` | — | Gains `plus` from the design's symbols |
| `AppBar` | gains `step?: { current: number; total: number }` | Renders "{current} de {total}" at the end of the bar |
| `Chip` | `children`, `onClick`, `pressed?`, `disabled?` | A pill `button` with a 44 px height and `aria-pressed` |
| `Checkbox` | `label`, `id`, `checked`, `onChange`, React 19 `ref` | A native checkbox with a custom 20 px box and a 44 px hit area |
| `SummaryList` | `items: { key: string; label: ReactNode; value: ReactNode }[]` | A `<dl>` of label and value rows on `lavender-100`, values right-aligned with `tabular-nums`. SPEC 08's receipt reuses it |
| `ProgressSteps` | `current`, `total`, `label` | `total` bars, the first `current` filled; `role="progressbar"` with `aria-valuenow`, `aria-valuemax` and the label |
| `Stepper` | `steps: { label; href?; state: StepState }[]`, `label` | An `<ol>` of numbered dots joined by lines; `done` shows a check and links when it has `href`, `current` has `aria-current="step"`. `STEP_STATE = { DONE, CURRENT, UPCOMING }` |

Each folder has its `types.ts` when it declares constants, and only consumes CSS variables.

### Tokens (`src/app/globals.css`, SPEC 00 §14)

| CSS token | Value | Usage |
| --- | --- | --- |
| `--container-wizard` | `560px` | Desktop wizard card; Tailwind `max-w-wizard` |
| `--size-contact-row` | `64px` | Contact rows in the recipient step |
| `--size-step-dot` | `28px` | `Stepper` dots |
| `--size-progress-bar` | `4px` | `ProgressSteps` bar height |
| `--size-checkbox` | `20px` | `Checkbox` box |
| `--text-size-amount` | `34px` | The amount in the amount and review steps on mobile; `--text-size-hero` (44 px) from `lg` |

### Transfers feature (`src/features/transfers/`)

One folder per component, each with `.tsx`, `.test.tsx` and, when needed, `.module.scss` and `types.ts`.

| Path | Responsibility |
| --- | --- |
| `draft/draft-store.ts`, `draft/use-draft-hydration.ts`, `draft/step-guard.ts`, `draft/use-step-guard.ts` | The draft, its hydration and the guards above |
| `api/contact-queries.ts`, `api/use-create-contact.ts` | Contacts read and create |
| `hooks/use-transfer-balance.ts` | `useQuery(walletSummaryQueryOptions())` and the derived "Saldo después" |
| `hooks/use-new-recipient-mode.ts` | Reads `?mode=new` with `useSearchParams` and opens or closes it through the History API |
| `components/wizard-shell/` | Shell, titles, back targets, `Stepper`, `ProgressSteps`, live summary slot |
| `components/amount-step/`, `components/amount-input/` | Step 1 |
| `components/recipient-step/`, `components/contact-list/`, `components/contact-row/` | Step 2 |
| `components/new-recipient-form/` | Step 2b |
| `components/review-step/`, `components/live-summary/` | Step 3 and the desktop aside |
| `components/wizard-state/` | The centered empty and error block for contacts, styled like Home's `movements-state` |

### Pages (`src/app/(private)/transfers/new/`)

| File | Content |
| --- | --- |
| `layout.tsx` | Static; renders `WizardShell` around `children` |
| `amount/page.tsx` | `AmountStep`; metadata title "Enviar dinero" |
| `recipient/page.tsx` | `RecipientStep` inside `<Suspense>`, because it reads `useSearchParams`; metadata title "Elegir destinatario" |
| `review/page.tsx` | `ReviewStep` with no `onConfirm`; metadata title "Revisar envío" |

The pages are Client Components inside a static shell, as SPEC 00 §4 says. They read no cookies, headers or `searchParams` on the server.

### Messages (`src/messages/es-MX/transfers.json`)

A new `transfers` namespace, registered in `index.ts`:

| Key | es-MX |
| --- | --- |
| `transfers.metaTitles.amount` / `recipient` / `review` | "Enviar dinero" / "Elegir destinatario" / "Revisar envío" |
| `transfers.steps.amount` / `recipient` / `review` | "Monto" / "Destinatario" / "Revisión" |
| `transfers.steps.counter` / `label` | "{current} de {total}" / "Progreso del envío" |
| `transfers.titles.amount` / `recipient` / `newRecipient` / `review` / `desktop` | "Enviar dinero" / "¿A quién le envías?" / "Nuevo destinatario" / "Revisa tu envío" / "Enviar dinero" |
| `transfers.actions.continue` / `continueWith` / `back` / `cancel` / `edit` / `confirm` / `home` | "Continuar" / "Continuar con {name}" / "Atrás" / "Cancelar" / "Editar datos" / "Confirmar envío" / "Inicio" |
| `transfers.amount.label` / `available` / `all` / `insufficientFunds` | "¿Cuánto quieres enviar?" / "Disponible: {amount}" / "Todo" / "El monto supera tu saldo disponible. Escribe una cantidad menor o igual a {balance}." |
| `transfers.amount.concept` / `conceptOptional` / `conceptPlaceholder` / `conceptCounter` | "Concepto" / "(opcional)" / "Ej. Cena viernes" / "{count}/40" |
| `transfers.amount.balanceError` / `balanceRequired` / `retry` | "No pudimos cargar tu saldo" / "Necesitamos tu saldo para validar el monto." / "Reintentar" |
| `transfers.recipient.favorites` / `listLabel` / `add` | "Tus favoritos" / "Contactos favoritos" / "Agregar nuevo destinatario" |
| `transfers.recipient.error.title` / `retry` | "No pudimos cargar tus contactos" / "Reintentar" |
| `transfers.recipient.empty.title` / `text` | "Aún no tienes contactos guardados" / "Agrega a alguien para enviarle dinero." |
| `transfers.newRecipient.type` / `name` / `phone` / `clabe` / `card` / `bank` / `favorite` / `error` / `retry` | "Tipo de cuenta" / "Nombre del destinatario" / "Número celular" / "CLABE interbancaria" / "Número de tarjeta" / "Banco detectado: {bank}" / "Guardar en favoritos" / "No pudimos guardar el contacto." / "Reintentar" |
| `transfers.review.sending` / `to` / `account` / `concept` / `fee` / `balanceAfter` | "Vas a enviar" / "Para" / "Cuenta" / "Concepto" / "Comisión" / "Saldo después" |
| `transfers.review.confirmUnavailable` / `ruleFailed` / `fix` | "Pronto podrás confirmar tu envío desde aquí." / "Algo cambió desde que empezaste:" / "Corregir" |
| `transfers.summary.title` / `note` | "Resumen" / "Revisarás todo antes de confirmar." |

The rule codes reuse `errors.validation.*`, except `INSUFFICIENT_FUNDS` on the amount step, which uses `transfers.amount.insufficientFunds` to show the balance.

### Tests setup (`src/test/`)

- `factories/contacts.ts` builds `ContactView`s.
- `msw/handlers.ts` gains `GET /api/v1/contacts` and `POST /api/v1/contacts` (`201`, `200` for a known account, and `400 RECIPIENT_IS_SELF` for Mariana's phone).
- `setup.ts` clears `sessionStorage` after each test.
- `e2e/fixtures/wizard.ts` gains `startTransfer(page, amount)` and `pickContact(page, name)`, which use the UI, not storage.

## Implementation plan

Each step leaves lint, typecheck and tests green and is committed on its own. Before writing a step, read the relevant guide in `node_modules/next/dist/docs/` (`01-getting-started/04-linking-and-navigating.md` for the History API, `03-api-reference/04-functions/use-search-params.md`, `03-api-reference/04-functions/use-router.md`, `03-api-reference/03-file-conventions/layout.md`), and the Zustand `persist` docs for `skipHydration`.

1. **Branch and docs.** Pull `develop` and create `feature/07-transfer-flow`. In SPEC 00, update:
   - §4: the shared wizard layout and `?mode=new`;
   - §5: the `src/features/transfers/` folders and `src/shared/lib/session-storage/`;
   - §8: the `POST /contacts` row;
   - §12: `apiPost` lands here, and SPEC 08 adds the timeout;
   - §14: the tokens.

   In `challenge.md` §8.4, record the outcome of the SPEC 07 rows: chips, "Comisión" and "Saldo después", the concept with its counter, "Continuar" always enabled, the vertical list and the desktop wizard card ship; "Recientes" and search do not. Link this spec from `roadmap.md` and mark 07 as in progress.
   - Why: other sessions read these files, not this chat.

2. **Dependency, tokens and icon.** `npm install zustand@^5`. Add the wizard tokens to `@theme static` and `plus` to `Icon`, with a render test.
   - Why: every later step consumes them.

3. **Domain.** Add `validateTransferAmount` and make `validateTransfer` use it, and add `TRANSFER_FEE`. Tests: zero, negative, equal to the balance, one cent over, and `validateTransfer` returning the same violations as before.
   - Why: the amount step needs rules 1 and 2 without a recipient, from the same function the server runs.

4. **Contacts service and endpoint.** Move `ContactView` to `views.ts`. Change `create` to the `Result` above, and update the create handler and its tests. Tests:
   - creating an existing account answers `200` with the same id and upgrades it to favorite;
   - an existing favorite is not downgraded by `saveAsFavorite: false`;
   - creating with Mariana's phone answers `400` `RECIPIENT_IS_SELF`;
   - a new favorite answers `201` and the next `GET` includes it;
   - a new non-favorite answers `201` and the next `GET` does not include it.
   - Why: the data the recipient step relies on, proven before any UI exists.

5. **API client and contacts queries.** Add `apiPost` with a shared `toResult`, `contact-queries.ts`, `use-create-contact.ts`, the contacts factory and the MSW handlers. Tests:
   - `apiPost` sends JSON with `Content-Type` and maps a `400` envelope to `api` with `details`;
   - a rejected `fetch` becomes `network`;
   - the mutation writes a new favorite into the cached list in name order, does not duplicate an existing id, and leaves the list alone for a non-favorite.
   - Why: the client contract the recipient step builds on, and the one SPEC 08 extends.

6. **Draft, guards and logout cleanup.** Create `client-session.ts`, the draft store, `useDraftHydration`, `resolveStepAccess` and `useStepGuard`. Call `clearClientSession` from `LogoutButton` and from the `UNAUTHORIZED` redirect. Tests:
   - every `resolveStepAccess` case, including the `default` branch with an invalid step;
   - `claim` with another owner resets the draft;
   - `setAmount` with a new value clears the key, and with the same value keeps it;
   - `ensureIdempotencyKey` is stable;
   - a stored draft with another version is dropped;
   - `clearClientSession` survives a throwing `sessionStorage`;
   - submitting `LogoutButton` removes the key.
   - Why: the state every step reads, and the privacy rules around it.

7. **Primitives.** Add `step` to `AppBar`, and create `chip/`, `checkbox/`, `summary-list/`, `progress-steps/` and `stepper/`. Tests:
   - `AppBar` renders the counter text;
   - `Chip` toggles `aria-pressed` and respects `disabled`;
   - `Checkbox` is labeled and toggles;
   - `SummaryList` renders a `<dl>` in order;
   - `ProgressSteps` exposes `aria-valuenow`;
   - `Stepper` marks the current step with `aria-current="step"`, links done steps and does not link upcoming ones.
   - Why: the wizard and SPEC 08's receipt are built from these.

8. **Routes and wizard shell.** Add the transfer routes to `ROUTES` and replace the two literals. Create `wizard-shell/`, `live-summary/`, `use-transfer-balance.ts`, the `transfers/new/layout.tsx`, and three placeholder pages that render each step's heading. Add the `transfers.json` namespace. Tests:
   - the mobile title and counter follow the path;
   - the desktop `Stepper` links only completed steps;
   - the live summary is not rendered on the review;
   - "Cancelar" resets the draft;
   - focus moves to the heading on a step change.

   Manual check: "Enviar dinero" on Home opens step 1 inside the private shell on mobile and desktop widths.
   - Why: every step renders inside this chrome.

9. **Amount step.** Create `amount-input/`, `formatAmountInput` and `amount-step/`. Tests:
   - typing `12450.8` shows `12,450.8`, and a third decimal and letters are ignored;
   - the chips set the amount, and "Todo" sets the balance;
   - `0` shows `AMOUNT_NOT_POSITIVE`, and an amount over the balance shows the balance message;
   - the concept counter reaches `40/40` and stops;
   - a valid submit stores cents and concept and goes to `recipient`;
   - a reload restores the amount;
   - a `503` summary shows the balance error and blocks the submit.
   - Why: rules 1 and 2 on the client, with the approved amount entry.

10. **Recipient step.** Create `recipient-step/`, `contact-list/`, `contact-row/` and `wizard-state/`. Tests over MSW:
    - the four favorites render in name order;
    - Diego's empty state shows "Agregar nuevo destinatario";
    - a `503` shows the error with "Reintentar", and retrying loads the list;
    - "Continuar" with nothing selected shows `RECIPIENT_REQUIRED`;
    - choosing Carlos changes the CTA to "Continuar con Carlos" and stores the masked recipient;
    - opening `/transfers/new/recipient` with an empty draft redirects to `amount`.
    - Why: rule 3 and the favorites list.

11. **New-recipient form.** Create `new-recipient-form/` and `use-new-recipient-mode.ts`. Tests:
    - "Agregar nuevo destinatario" pushes `?mode=new`, and back returns to the list;
    - switching the type swaps the field and keeps the name;
    - a valid CLABE shows "Banco detectado: Banamex";
    - an invalid card shows `CARD_INVALID_CHECKSUM`;
    - saving stores the returned contact in the draft and goes to `review`;
    - `RECIPIENT_IS_SELF` lands on the phone field;
    - a `503` shows the alert and keeps the values;
    - unchecking "Guardar en favoritos" sends `saveAsFavorite: false`.
    - Why: the PDF's "enter a new contact manually and save it", without a full account number on the client.

12. **Review step.** Create `review-step/` and finish `live-summary/`. Tests:
    - the rows show recipient, masked account, concept, "$0.00" and the balance after;
    - an empty concept hides its row;
    - entering creates one idempotency key, and a reload keeps it;
    - a balance below the amount shows the alert and keeps "Confirmar envío" disabled;
    - with no `onConfirm` the button is disabled with its note;
    - "Editar datos" goes to `amount` with the draft intact;
    - opening `/transfers/new/review` without a recipient redirects to `recipient`.
    - Why: the PDF's summary before confirming, with the three rules applied again.

13. **E2E.** Create `e2e/fixtures/wizard.ts` and `e2e/transfer-wizard.spec.ts`. Cover:
    - Home's "Enviar dinero" opens step 1;
    - `0` and an amount over the balance show their errors;
    - "Todo" fills `12,450.80`;
    - Carlos from the favorites reaches the review with "Saldo después";
    - a reload on the review keeps everything;
    - a new CLABE contact shows "Banco detectado: Banamex" and appears in the favorites when going back;
    - Mariana's own phone shows the self error;
    - Diego sees the empty contacts state;
    - `mock_read_scenario=error` shows the contacts error, and "Reintentar" loads the list after the cookie is cleared;
    - opening the review with no draft lands on the amount step;
    - logging out and back in starts with an empty draft;
    - on `desktop`, the stepper links back to completed steps and the live summary updates;
    - on `mobile`, the CTA sits in the bottom action bar.
    - Why: proves the guards, the persistence and both layouts in a real browser.

14. **Docs.** Add a "Transfer wizard" section to `CLAUDE.md`. It covers:
    - the draft store, `skipHydration` and the guards;
    - masked-only recipients, `claim` and `clearClientSession`;
    - the idempotency key lifecycle;
    - `?mode=new` and `saveAsFavorite`;
    - `apiPost`, and the `onConfirm` slot SPEC 08 fills.

    Mark SPEC 07 as `Implemented` in `roadmap.md` once the criteria pass.
    - Why: SPEC 08 builds on these conventions from another session.

## Acceptance criteria

- [ ] `package.json` lists `zustand` 5.x under `dependencies`.
- [ ] SPEC 00 §4, §5, §8, §12 and §14 and `challenge.md` §8.4 describe the decisions of this spec.
- [ ] `validateTransferAmount` returns `AMOUNT_NOT_POSITIVE` for 0 and `INSUFFICIENT_FUNDS` for one cent over the balance, with 100 % coverage on `src/domain/**`.
- [ ] `POST /api/v1/contacts` answers `201` for a new account, `200` with the same `id` for an existing one, and `400` with `details.account: ["RECIPIENT_IS_SELF"]` for the user's own phone.
- [ ] A contact created with `saveAsFavorite: false` is not returned by `GET /api/v1/contacts`.
- [ ] No response from `/api/v1/contacts` contains more than 4 digits of an account.
- [ ] After any wizard step, `sessionStorage["smw.transfer-draft"]` contains no phone, CLABE or card number with more than 4 digits.
- [ ] "Enviar dinero" on Home opens `/transfers/new/amount`, which shows "1 de 3" on mobile and the `Stepper` with "Monto" current on desktop.
- [ ] Typing `12450.8` shows `12,450.8`, and the draft stores `1245080` cents.
- [ ] "Continuar" is always enabled. With `0` it shows the minimum-amount error, and with more than the balance it shows "El monto supera tu saldo disponible…".
- [ ] "Todo" fills the whole available balance, and the concept counter stops at `40/40`.
- [ ] Reloading any step keeps the amount, concept and recipient.
- [ ] Opening `/transfers/new/review` with an empty draft lands on `/transfers/new/amount`, and opening it with only an amount lands on `/transfers/new/recipient`.
- [ ] Mariana sees Ana, Carlos, Diego and Luis under "Tus favoritos", and Diego sees the empty contacts state.
- [ ] "Continuar" with no recipient shows the recipient-required error, and choosing Carlos turns the mobile CTA into "Continuar con Carlos".
- [ ] "Agregar nuevo destinatario" changes the URL to `?mode=new` without a full page load, and the browser's back button returns to the list.
- [ ] A valid CLABE starting with `002` shows "Banco detectado: Banamex", and saving it with "Guardar en favoritos" adds it to the favorites.
- [ ] Saving Mariana's own phone shows the self-transfer error on the phone field.
- [ ] With `mock_read_scenario=error`, the recipient step shows "No pudimos cargar tus contactos" with "Reintentar" and "Referencia: …", and the amount step shows the balance error.
- [ ] The review shows "Para", "Cuenta", "Concepto" (when set), "Comisión $0.00", and "Saldo después" equal to the balance minus the amount.
- [ ] Entering the review stores one idempotency key that survives a reload, and changing the amount and returning stores a different one.
- [ ] "Confirmar envío" is the only orange element on the review, and it is disabled with its note.
- [ ] "Editar datos" opens the amount step with the previous amount and concept.
- [ ] From 1024 px, steps 1 and 2 show a 560 px card beside a 340 px sticky summary, step 3 shows the card alone, and completed steps in the `Stepper` are links.
- [ ] Below 1024 px the step's CTA sits in the bottom action bar.
- [ ] After logging out and logging in again in the same tab, the amount step starts empty.
- [ ] Every touch target in the wizard is at least 44 × 44 px, and no text is smaller than 12 px.
- [ ] `chip`, `checkbox`, `summary-list`, `progress-steps` and `stepper` live in `src/shared/ui/` with `.tsx`, `.test.tsx`, `.module.scss` where they have styles and `types.ts` where they declare constants, and no SCSS file has a hex value or a loose measured value.
- [ ] `npm run test:e2e` passes on the `mobile` and `desktop` projects.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100 % on `src/domain/**`, 80 % on `src/server/**`, `src/shared/lib/**` and `src/shared/observability/**`) and `npm run build` finish with no errors.
- [ ] No component or page contains user-facing text outside `src/messages/es-MX/`.
- [ ] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** "Confirmar envío" is rendered and disabled, through an `onConfirm` slot that SPEC 08 fills (user decision). The roadmap ends this milestone just before confirming, and SPEC 08 only plugs in the hook.
- **No:** a success-only POST in this milestone. The receipt would answer `404` until SPEC 08, and the five outcomes would be split across two specs.
- **Yes:** every new recipient is saved through `POST /api/v1/contacts`, and the draft keeps only its id and masked view (user decision). A full CLABE or card number never sits in `sessionStorage`, which any script on the origin can read.
- **No:** a `{ kind: "new" }` draft carrying the full account to `POST /transfers`. It breaks SPEC 00 §6 on the client, and it adds a second recipient path to SPEC 08.
- **Yes:** `ContactService.create` honors `saveAsFavorite`. The checkbox was decorative before, and a contact used once should not become a favorite.
- **Yes:** an existing account returns the stored contact with `200`, and can be upgraded to a favorite but never downgraded. Creating a contact is idempotent by account, and an accidental uncheck never removes a favorite.
- **Yes:** the recipient step shows only the favorites list (user decision, scope trim). The PDF asks for "the favorites list", and the deadline leaves no room for extras that need server changes.
- **No:** the "Recientes" row and contact search, for now (user decision, scope trim). Recents need a `lastUsedAt` computed from movements, and a user with a few favorites does not need search. Both stay possible later without changing the draft or the API shape.
- **No:** a `/design` pass for the screens the design does not draw, for now (user decision, scope trim). They are composed from the drawn desktop step 2, the mobile screens and Home's state components, as the "Design reference" table fixes.
- **Yes:** on the desktop review, the live summary is not rendered and the card holds the review. The design says the summary "becomes the review"; showing the same rows twice adds nothing.
- **Yes:** the amount is typed as a decimal, formatted live, then parsed by `parseAmount` (user decision). It matches the mobile review's decimal keyboard, and money stays in integer cents.
- **No:** an ATM-style cents mask. It does not match the drawn keyboard, and typing "350" giving "$3.50" surprises users.
- **Yes:** `?mode=new` on the recipient route for the new-recipient form (user decision). Back works, the desktop form stays in the same card, and the route map does not grow.
- **No:** a `/transfers/new/recipient/new` route. It adds a route and breaks the desktop "same card" layout.
- **Yes:** the draft persists in the tab until logout, an owner change, "Cancelar" or a successful transfer (user decision). Leaving the wizard by accident loses nothing.
- **Yes:** the draft records its `ownerId`, and `clearClientSession` runs on logout. `sessionStorage` outlives the session cookie in the same tab.
- **Yes:** `skipHydration` with a hydration hook. Server and client render the same markup, and guards never redirect on a draft that has not loaded yet.
- **Yes:** a pure `resolveStepAccess` plus a client redirect. The proxy cannot see `sessionStorage`, and a pure function is testable without a router.
- **Yes:** the idempotency key is created when entering the review and cleared when the payload changes. SPEC 00 §9 fixes when it is created; clearing it prevents a `409` after an edit.
- **Yes:** the balance blocks the amount step when it cannot load, with "Reintentar" (user decision). Rule 2 cannot run on the client without it.
- **Yes:** "Comisión $0.00" and "Saldo después" in the review and the live summary (user decision), with the fee as a domain constant. The approved design shows both, and the constant is the one place a fee would change.
- **Yes:** "Editar datos" returns to the amount step with the draft intact, and the desktop `Stepper` links completed steps (user decision). One simple path on mobile, and a shortcut on desktop as designed.
- **Yes:** `validateTransferAmount` is extracted from `validateTransfer`. The amount step and the server run the same rules 1 and 2.
- **Yes:** `apiPost` lands here without a timeout. Creating a contact needs it, and SPEC 08 adds the timeout only where the brief asks for one.
- **Yes:** contacts queries stay in `src/features/transfers/api/`. Only the wizard reads contacts; the balance comes from the shared wallet key.
- **Yes:** `Chip`, `Checkbox`, `SummaryList`, `ProgressSteps` and `Stepper` in `shared/ui`. They have no transfer logic, and SPEC 08's receipt reuses `SummaryList`.
- **No:** a custom numeric keypad. The native keyboard with `inputMode="decimal"` is what the mobile review draws, and it is accessible by default.
- **No:** server prefetch for the wizard. SPEC 00 §4 makes these routes Client Components; the balance is usually cached from Home, and contacts load once.

## Risks

| Risk | Mitigation |
| --- | --- |
| The persisted draft renders differently on the server and the client | `skipHydration` plus `useDraftHydration`; the steps render a skeleton until hydrated |
| A guard redirects before the draft loads | `useStepGuard` waits for `hydrated`; tested with an empty and a full stored draft |
| `sessionStorage` throws in private mode | The store's storage and `clearClientSession` catch it; the wizard works in memory for that tab |
| An edited payload reuses an idempotency key and SPEC 08 gets `409` | `setAmount` and `setRecipient` clear the key; tested in step 6 |
| The balance changes between the amount step and the review | The review re-runs `validateTransfer` against the current balance; the server decides anyway |
| A contact saved with "Guardar en favoritos" unchecked never shows in the list again | Intended: it was a one-off recipient. Saving the same account later with the box checked upgrades it to a favorite |
| Undrawn screens drift from the visual language | The "Design reference" table names the drawing or component each one copies; no new visual patterns |
| `useSearchParams` without `<Suspense>` breaks the build | The recipient page wraps its step in `<Suspense>`; `npm run build` is an acceptance criterion |
| Formatting the amount moves the caret while typing | `formatAmountInput` keeps the caret offset from the end of the text; covered by a component test |

## What is **not** in this spec

- Sending the transfer, the processing dialog and the five outcomes (SPEC 08).
- The receipt, Home cache invalidation and the DEV scenario panel (SPEC 08).
- The "Recientes" row, contact search and a `/design` pass for the undrawn wizard screens.
- "Envío rápido" and a preselected recipient through the URL.
- Editing, deleting or un-favoriting contacts, and a contacts page.
- A custom numeric keypad and swipe gestures between steps.

Each of them lands in the milestone listed in `specs/roadmap.md`, or stays out of the project.
