# SPEC 02 — Domain layer

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 01
> **Date:** 2026-10-21
> **Objective:** Build the framework-free domain layer (entity types, money, validators, the three business rules and the Zod schemas) with stable error codes, es-MX messages for every code and 100 % unit test coverage.

**Branch:** `feature/02-domain` (branched from `develop`, merged back through a PR to `develop`).

## Why this spec exists

The PDF evaluates "business rules in the right place, not only in the UI". In this project that place is `src/domain/`: pure TypeScript that the client forms, the Route Handlers and the services will all import. Building it first, with no UI and no server, makes every rule testable in isolation and gives milestones 03 to 07 a single contract to depend on.

The domain never speaks Spanish. It returns stable error codes (`PHONE_INVALID_LENGTH`), and the UI translates them through `errors.validation.<CODE>`. The API (SPEC 03) returns the same codes in `error.details`, so client and server speak one vocabulary.

## Scope

**In:**

- Shared primitives: `Brand`, `Result` with `ok`/`err` helpers, and the `ValidationCode` catalog.
- Money: `Cents`, `Money`, parsing of user-typed amounts, arithmetic and comparison helpers, and a technical maximum.
- Entity types: `User`, `Wallet`, `Movement`, `Contact`, `RecipientAccount`, `TransferRecipientInput` and `Transfer` (SPEC 00 section 6).
- Identity validators: mobile number (with normalization), email, password and full name.
- Recipient account validators: CLABE (18 digits + Banxico check digit), card (16 digits + Luhn), bank detection from the CLABE prefix, and account masking.
- Concept validator and the three business rules in `validateTransfer`.
- Zod schemas for registration, login, new contact, transfer amount and the create-transfer payload, built on the validators.
- `src/messages/es-MX/errors.json` with a Spanish message for every validation code, plus a test that fails if one is missing.
- A 100 % coverage threshold for `src/domain/**`.

**Out of scope (for future specs):**

- Persistence, repositories, services, Route Handlers, session primitives and scenarios (SPEC 03).
- Rejecting a transfer to the sender's own account. It needs the sender's identity, so it is decided in SPEC 03.
- Display formatting of money and dates with `Intl` (`src/shared/lib`, SPEC 05). The domain only works with cents.
- Any React component or form wiring (SPEC 04 onwards).
- Validating the CLABE bank code against a full Banxico catalog.

## Data model

All files live under `src/domain/`. Nothing here imports `react`, `next`, `next-intl`, `@/server`, `@/features` or `@/shared/ui` (already enforced by ESLint). `zod` is allowed.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
declare function ok<T>(value: T): Result<T, never>;
declare function err<E>(error: E): Result<never, E>;
```

Validation codes (`src/domain/shared/validation-codes.ts`), one `as const` array and its union type:

```ts
type ValidationCode =
  | "AMOUNT_REQUIRED" | "AMOUNT_INVALID_FORMAT" | "AMOUNT_TOO_MANY_DECIMALS" | "AMOUNT_EXCEEDS_MAXIMUM"
  | "AMOUNT_NOT_POSITIVE" | "INSUFFICIENT_FUNDS" | "RECIPIENT_REQUIRED"
  | "PHONE_REQUIRED" | "PHONE_INVALID_CHARACTERS" | "PHONE_INVALID_LENGTH"
  | "EMAIL_REQUIRED" | "EMAIL_INVALID_FORMAT"
  | "PASSWORD_REQUIRED" | "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG"
  | "PASSWORD_MISSING_UPPERCASE" | "PASSWORD_MISSING_NUMBER" | "PASSWORD_MISMATCH"
  | "NAME_REQUIRED" | "NAME_TOO_SHORT" | "NAME_TOO_LONG" | "NAME_INVALID_CHARACTERS"
  | "CLABE_REQUIRED" | "CLABE_INVALID_LENGTH" | "CLABE_INVALID_CHECK_DIGIT"
  | "CARD_REQUIRED" | "CARD_INVALID_LENGTH" | "CARD_INVALID_CHECKSUM"
  | "CONCEPT_TOO_LONG" | "CONCEPT_INVALID_CHARACTERS";
```

Money (`src/domain/money/money.ts`):

```ts
type Cents = Brand<number, "Cents">;
interface Money { amountInCents: Cents; currency: "MXN" }

const MAX_AMOUNT_IN_CENTS = 99_999_999;
declare function parseAmount(input: string): Result<Cents, AmountParseCode>;
declare function toMoney(amountInCents: Cents): Money;
declare function addMoney(a: Money, b: Money): Money;
declare function subtractMoney(a: Money, b: Money): Money;
declare function compareMoney(a: Money, b: Money): -1 | 0 | 1;
```

`parseAmount` rules:

- Leading `$`, spaces and comma thousand separators are stripped. `.` is the only decimal separator.
- The remaining text must match one or more digits with at most two decimals, otherwise `AMOUNT_INVALID_FORMAT` (this also rejects a minus sign).
- Three or more decimals return `AMOUNT_TOO_MANY_DECIMALS`.
- A value above `MAX_AMOUNT_IN_CENTS` ($999,999.99) returns `AMOUNT_EXCEEDS_MAXIMUM`. This is a technical input limit, not a business rule.
- An empty string returns `AMOUNT_REQUIRED`.
- `"0"` parses to `0`. Rejecting zero is the job of the business rule, not the parser.
- The conversion to cents never uses floating-point multiplication; it composes the integer and decimal parts.

Validators return `Result<NormalizedValue, ValidationCode>` and report the first failure:

| Function | File | Normalization | Codes |
| --- | --- | --- | --- |
| `validatePhone` | `user/validators.ts` | Strip spaces, `-`, `.`, `(`, `)`; drop a leading `+52`, or `52` when 12 digits remain | `PHONE_REQUIRED`, `PHONE_INVALID_CHARACTERS`, `PHONE_INVALID_LENGTH` |
| `validateEmail` | `user/validators.ts` | Trim and lowercase; max 254 chars | `EMAIL_REQUIRED`, `EMAIL_INVALID_FORMAT` |
| `validatePassword` | `user/validators.ts` | None | `PASSWORD_REQUIRED`, `PASSWORD_TOO_SHORT` (< 8), `PASSWORD_TOO_LONG` (> 128), `PASSWORD_MISSING_UPPERCASE`, `PASSWORD_MISSING_NUMBER` |
| `validateFullName` | `user/validators.ts` | Trim and collapse inner spaces; Unicode letters, spaces, `'`, `-`, `.`; 3 to 60 chars | `NAME_REQUIRED`, `NAME_TOO_SHORT`, `NAME_TOO_LONG`, `NAME_INVALID_CHARACTERS` |
| `validateClabe` | `contact/validators.ts` | Strip spaces and `-` | `CLABE_REQUIRED`, `CLABE_INVALID_LENGTH`, `CLABE_INVALID_CHECK_DIGIT` |
| `validateCardNumber` | `contact/validators.ts` | Strip spaces and `-` | `CARD_REQUIRED`, `CARD_INVALID_LENGTH`, `CARD_INVALID_CHECKSUM` |
| `validateRecipientAccount` | `contact/validators.ts` | Dispatches on `type` to phone, CLABE or card | Codes of the delegated validator |
| `validateConcept` | `transfer/validators.ts` | Trim; empty becomes `undefined`; letters, digits, spaces and `.,-`; max 40 chars | `CONCEPT_TOO_LONG`, `CONCEPT_INVALID_CHARACTERS` |

CLABE check digit: multiply the first 17 digits by the repeating weights `3, 7, 1`, keep each product modulo 10, sum them, and the check digit is `(10 - sum % 10) % 10`.

Bank detection (`contact/banks.ts`): `detectBank(clabe): BankName | null` reads the first 3 digits against this catalog. A code outside the catalog returns `null` and the CLABE stays valid.

| Code | Bank | Code | Bank | Code | Bank |
| --- | --- | --- | --- | --- | --- |
| `002` | Banamex | `036` | Inbursa | `072` | Banorte |
| `012` | BBVA México | `042` | Mifel | `127` | Banco Azteca |
| `014` | Santander | `044` | Scotiabank | `130` | Compartamos |
| `021` | HSBC | `058` | Banregio | `137` | BanCoppel |
| `030` | Banco del Bajío | `062` | Afirme | `166` | Banco del Bienestar |

Masking (`contact/mask.ts`): `maskAccount(account: RecipientAccount): string` returns `•••• ` plus the last 4 digits for every account type.

Business rules (`transfer/rules.ts`):

```ts
type TransferRuleViolation = "AMOUNT_NOT_POSITIVE" | "INSUFFICIENT_FUNDS" | "RECIPIENT_REQUIRED";
interface TransferDraft { amount: Money; recipient: TransferRecipientInput | null }
interface ValidTransfer { amount: Money; recipient: TransferRecipientInput }
declare function validateTransfer(draft: TransferDraft, availableBalance: Money): Result<ValidTransfer, TransferRuleViolation[]>;
```

`validateTransfer` collects every violation instead of stopping at the first one. An amount equal to the balance is valid.

Zod schemas (one `schemas.ts` per module). Each schema delegates to the validators above and reports failures as issues whose `message` is the `ValidationCode`, so the output is the normalized value:

| Schema | File | Shape |
| --- | --- | --- |
| `registerSchema` | `user/schemas.ts` | `{ fullName, phone, email, password, passwordConfirmation }`; mismatch reports `PASSWORD_MISMATCH` on `passwordConfirmation` |
| `loginSchema` | `user/schemas.ts` | Discriminated on `method`: `{ method: "phone", phone, password }` or `{ method: "email", email, password }`. The password is only required, the policy is not checked |
| `recipientAccountSchema` | `contact/schemas.ts` | Discriminated on `type`: `phone`, `clabe` or `card` |
| `newContactSchema` | `contact/schemas.ts` | `{ name, account, saveAsFavorite }` |
| `transferAmountSchema` | `transfer/schemas.ts` | `{ amount: string }`, output `{ amountInCents: Cents }` |
| `createTransferSchema` | `transfer/schemas.ts` | `{ amountInCents: number, recipient: TransferRecipientInput, concept?: string }` for the API payload |

`toFieldErrors(error: z.ZodError): Record<string, ValidationCode[]>` (`shared/validation.ts`) turns a Zod error into the map that SPEC 03 returns in `error.details` and that the forms read.

Messages: `src/messages/es-MX/errors.json` holds `errors.validation.<CODE>` for every `ValidationCode`, registered in `src/messages/es-MX/index.ts`. The copy says what is wrong and how to fix it, for example `PHONE_INVALID_LENGTH`: "Escribe un número celular de 10 dígitos."

## Implementation plan

Each step leaves typecheck, lint and tests green and is committed on its own.

1. **Shared primitives.** Create `src/domain/shared/brand.ts`, `result.ts` (`Result`, `ok`, `err`) and `validation-codes.ts` (`VALIDATION_CODES` as const plus `ValidationCode`). Test `ok` and `err`.
   - Why: every later file depends on these three pieces. `Result` makes failure part of the return type, so callers cannot forget to handle it the way they can forget a `try/catch`.

2. **Money.** Create `src/domain/money/money.ts` with `Cents`, `Money`, `MAX_AMOUNT_IN_CENTS`, `parseAmount`, `toMoney`, `addMoney`, `subtractMoney` and `compareMoney`. Test every `parseAmount` rule from the data model, including `"0.1"` → `10`, `"19.99"` → `1999` and `"1,234.5"` → `123450`.
   - Why: money is the most dangerous primitive in a wallet. Integer cents and an explicit parser remove floating-point errors such as `0.1 + 0.2`.

3. **Entity types.** Create `types.ts` in `user/`, `wallet/`, `contact/` and `transfer/` with the interfaces from SPEC 00 section 6, using branded IDs (`UserId`, `ContactId`, `TransferId`, `MovementId`). Types only, no tests.
   - Why: they are the shared vocabulary of milestones 03 to 07. Branded IDs make passing a `ContactId` where a `UserId` is expected a compile error.

4. **Identity validators.** Create `src/domain/user/validators.ts` with `validatePhone`, `validateEmail`, `validatePassword` and `validateFullName`. Test the normalization and every code, including `"+52 (55) 1234-5678"` → `"5512345678"` and `"525512345678"` → `"5512345678"`.
   - Why: login, registration and contacts all depend on these rules. Normalizing on input means `+52 55…` and `55…` are the same user.

5. **Recipient accounts.** Create `src/domain/contact/validators.ts` (`validateClabe`, `validateCardNumber`, `validateRecipientAccount`), `banks.ts` (`detectBank`) and `mask.ts` (`maskAccount`). Test valid and invalid check digits, a valid CLABE with an unknown bank code, Luhn with `4111 1111 1111 1111`, and masking for the three account types.
   - Why: a mistyped CLABE or card sends money to the wrong account. The check digit catches most typos before the user confirms.

6. **Concept and business rules.** Create `src/domain/transfer/validators.ts` (`validateConcept`) and `rules.ts` (`validateTransfer`). Test each rule alone, all three together, and the boundary where the amount equals the balance.
   - Why: these are the three rules the PDF names. As a pure function they run the same way in the form, the Route Handler and the service.

7. **Zod schemas.** Create `src/domain/shared/validation.ts` (`toFieldErrors`) and the `schemas.ts` files listed in the data model. Test that each schema outputs normalized values, reports the expected code on the expected path, and that `toFieldErrors` groups codes by field.
   - Why: React Hook Form (client) and the Route Handlers (server) consume Zod. Building the schemas on top of the validators keeps a single implementation of each rule.

8. **es-MX error messages.** Create `src/messages/es-MX/errors.json` with one message per `ValidationCode` and register it in `index.ts`. Add `src/messages/es-MX/errors.test.ts`, which fails if any code in `VALIDATION_CODES` has no message.
   - Why: the UI never shows a raw code to the user. The test turns "someone added a code and forgot the message" into a red build.

9. **Domain coverage gate.** Add a `src/domain/**` threshold of 100 % for lines, branches, functions and statements in `vitest.config.mts`, keeping the global 80 %.
   - Why: pure functions without I/O have no excuse for untested branches. A drop in coverage there means an untested rule.

10. **Agent documentation.** Add a "Domain" section to `CLAUDE.md`: what lives in `src/domain/`, the error-code convention and where new codes and their messages go.
    - Why: the next milestones add codes. The convention must be clear to whoever, person or agent, does it.

## Acceptance criteria

- [x] `parseAmount("1,234.5")` returns `ok(123450)` and `parseAmount("$19.99")` returns `ok(1999)`.
- [x] `parseAmount("10.001")` returns `AMOUNT_TOO_MANY_DECIMALS`, `parseAmount("-5")` returns `AMOUNT_INVALID_FORMAT` and `parseAmount("1000000")` returns `AMOUNT_EXCEEDS_MAXIMUM`.
- [x] `validatePhone("+52 (55) 1234-5678")` returns `ok("5512345678")`, and `validatePhone("55 1234 567")` returns `PHONE_INVALID_LENGTH`.
- [x] `validateEmail("  Mariana@Spin.TEST ")` returns `ok("mariana@spin.test")`.
- [x] `validatePassword("spin2026")` returns `PASSWORD_MISSING_UPPERCASE`.
- [x] A CLABE with an altered check digit returns `CLABE_INVALID_CHECK_DIGIT`, and a valid CLABE whose bank code is not in the catalog is accepted with `detectBank` returning `null`.
- [x] `validateCardNumber("4111 1111 1111 1111")` is valid and `validateCardNumber("4111 1111 1111 1112")` returns `CARD_INVALID_CHECKSUM`.
- [x] `maskAccount` returns `•••• 5678` for the phone `5512345678`.
- [x] `validateTransfer` with amount `0` and no recipient returns both `AMOUNT_NOT_POSITIVE` and `RECIPIENT_REQUIRED`.
- [x] `validateTransfer` with an amount equal to the balance is valid, and with one cent more returns `INSUFFICIENT_FUNDS`.
- [x] `registerSchema` with different passwords reports `PASSWORD_MISMATCH` on `passwordConfirmation`.
- [x] `loginSchema` accepts `{ method: "email", email, password: "x" }` without applying the password policy.
- [x] Every code in `VALIDATION_CODES` has a message in `src/messages/es-MX/errors.json`, verified by a test.
- [x] `npm run test:coverage` reports 100 % lines, branches, functions and statements for `src/domain/**` and fails below it.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` finish with no errors.
- [x] No file in `src/domain/` imports `react`, `next`, `next-intl`, `@/server`, `@/features` or `@/shared/ui`.
- [x] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** stable error codes in the domain, translated in the UI through `errors.validation.<CODE>` (user decision). The domain stays language-agnostic and the API returns the same codes.
- **No:** i18n keys as Zod messages. It couples the domain to the shape of the message files.
- **Yes:** each validator reports its first failure, while `validateTransfer` reports every rule violation. A field shows one error at a time; the transfer summary must explain everything that blocks confirmation.
- **Yes:** phone normalization of spaces, `-`, `.`, parentheses and the `+52`/`52` prefix (user decision). Copy-pasted numbers work.
- **Yes:** CLABE bank detection for display only (user decision). A partial catalog would reject valid CLABEs from small banks.
- **Yes:** technical cap of $999,999.99 and at most two decimals (user decision). It is an input limit, separate from the business rules.
- **Yes:** `parseAmount` accepts `"0"`. Keeping parsing and business rules apart lets the summary say "el monto debe ser mayor a cero" instead of "formato inválido".
- **Yes:** the login password is only required. Applying the registration policy at login would reveal the policy and block accounts created under an older one.
- **Yes:** `PASSWORD_TOO_LONG` at 128 characters. scrypt cost grows with input size; the cap closes a cheap denial of service.
- **Yes:** 100 % coverage gate on `src/domain/**`. The domain is pure; anything less means an untested rule.
- **No:** self-transfer rejection here. It needs the sender's identity, so it belongs to SPEC 03.
- **Yes:** the old milestone 02 split into 02 (domain) and 03 (simulated backend), with auth moving to 04 (user decision). Session primitives move to 03 so the API is protected from the start.

## Risks

| Risk | Mitigation |
| --- | --- |
| A wrong CLABE algorithm accepts invalid accounts | Tests include CLABEs computed by hand with the 3-7-1 weights, plus single-digit mutations that must fail |
| Zod 4 changes how custom issues and discriminated unions report paths | Step 7 tests assert the exact `path` of each issue, not just that parsing failed |
| A new code is added without a message | The step 8 test fails the build |
| The 100 % gate slows milestones down | It applies only to `src/domain/**`; the rest keeps 80 % |

## What is **not** in this spec

- Persistence, services, Route Handlers, session primitives and mock scenarios (SPEC 03).
- Self-transfer rejection (SPEC 03).
- Money and date display formatting (SPEC 05).
- UI components and form wiring (SPEC 04 onwards).
- Validation against the full Banxico bank catalog.

Each of them arrives in the milestone listed in `specs/roadmap.md`.
