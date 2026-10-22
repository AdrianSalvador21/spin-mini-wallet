# SPEC 03 — Simulated backend core: persistence, services and session

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 02
> **Date:** 2026-10-21
> **Objective:** Build the server-side core that every page and Route Handler will call (validated environment, JSON database with a write lock, seed data, repositories, services and signed-cookie session primitives) without exposing any HTTP endpoint yet.

**Branch:** `feature/03-mock-backend` (branched from `develop`, merged back through a PR to `develop`).

## Why this spec exists

The roadmap's milestone 03 touched five areas: persistence, session, HTTP API, scenarios and observability. Following the same rule that split the original milestone 02, it is split again (user decision):

- **03 (this spec):** the server core with no HTTP. Services are the source of truth for the three business rules (SPEC 00 §7, enforcement point 3), so they are built and tested in isolation first.
- **04:** the HTTP layer on top of this core: `/api/v1/*` Route Handlers, error envelope, CSRF, scenario engine, `proxy.ts` with `x-request-id`, logger, `ErrorReporter` and `instrumentation.ts`.

Everything after shifts by one: Authentication becomes 05, Home 06, Transfer flow 07, Confirmation 08 and Delivery 09. Step 1 records the new numbering in the roadmap, SPEC 00 and `challenge.md`.

Server Components call services directly (SPEC 00 §4), and Route Handlers will too. That is why services return **views** (masked accounts, no password hashes): no full account number can leave `src/server/`, whichever caller asks.

## Scope

**In:**

- Roadmap, SPEC 00 and `challenge.md` updated for the 03/04 split and for the structured movement model.
- Environment validation with Zod in `src/shared/config/env.ts`, a committed `.env.example`, and the variables wired into CI and Playwright.
- Vitest runs `src/server/**` tests in a `node` environment and resolves `server-only` to its empty module.
- Domain changes: structured `Movement` (no Spanish text), `MOVEMENT_TYPE` and `MOVEMENT_DIRECTION` constants, the movement cursor, and three new validation codes with es-MX messages.
- Password hashing with `scrypt` and `timingSafeEqual`.
- Session primitives: HMAC-signed token, `getSession()`, `requireSession()`, `setSessionCookie()`, `clearSessionCookie()` and `UnauthorizedError`.
- JSON database: snapshot schema, a process-wide write lock, atomic writes, creation from the seed and regeneration on a schema-version mismatch.
- Seed: Mariana (25 movements, 4 favorites) and Diego (empty state).
- Repositories behind a `Database` interface, and a JSON implementation.
- Services: `AuthService`, `WalletService`, `ContactService` and `TransferService`, including idempotency, self-transfer rejection, internal P2P credit and saving a new recipient as a favorite, all inside one critical section.
- A service container that builds the default services from the environment.
- A "Server core" section in `CLAUDE.md`.

**Out of scope (for future specs):**

- Any Route Handler, the `ApiErrorBody` envelope, CSRF checks and the mapping of service errors to HTTP status codes (SPEC 04).
- The scenario engine (`pickScenario`, `mock_scenario`, `mock_read_scenario`, artificial delays) (SPEC 04).
- `proxy.ts`, `x-request-id`, the logger with PII redaction, `ErrorReporter` and `instrumentation.ts` (SPEC 04).
- Server Actions for login, registration and logout, the route guard, the login rate limit and security headers (SPEC 05).
- Any UI, and money or date formatting with `Intl` (SPEC 05 onwards).
- Durable persistence on Vercel and multi-instance consistency (out of the project, SPEC 00 §2).

## Data model

### Domain changes (`src/domain/`)

`Movement` stops carrying user-facing text. The UI composes the Spanish label from `type` and the structured fields with next-intl (user decision):

```ts
export const MOVEMENT_TYPE = {
  TRANSFER_OUT: "transfer_out", TRANSFER_IN: "transfer_in",
  CASH_DEPOSIT: "cash_deposit", QR_PAYMENT: "qr_payment",
} as const;
export const MOVEMENT_DIRECTION = { DEBIT: "debit", CREDIT: "credit" } as const;

interface Movement {
  id: MovementId; userId: UserId; type: MovementType; direction: MovementDirection;
  amount: Money; counterpartyName?: string; merchantName?: string;
  transferId?: TransferId; createdAt: string;
}
```

- `transfer_out` / `transfer_in` carry `counterpartyName` and `transferId`.
- `cash_deposit` / `qr_payment` carry `merchantName` (e.g. `"OXXO Insurgentes"`).

Movement cursor (`src/domain/wallet/cursor.ts`): `encodeCursor({ createdAt, id }): string` returns base64url of `createdAt|id`, and `decodeCursor(cursor): Result<MovementCursor, "INVALID_CURSOR">`. It uses `btoa`/`atob` so the domain stays framework-free.

New validation codes, appended to `VALIDATION_CODES`, each with an es-MX message in `errors.json`:

| Code | When | Message |
| --- | --- | --- |
| `PHONE_ALREADY_REGISTERED` | Registration with a phone that already exists | "Este número celular ya tiene una cuenta. Inicia sesión." |
| `EMAIL_ALREADY_REGISTERED` | Registration with an email that already exists | "Este email ya tiene una cuenta. Inicia sesión." |
| `RECIPIENT_IS_SELF` | The recipient phone is the sender's own phone | "No puedes enviarte dinero a ti mismo." |

### Environment (`src/shared/config/env.ts`)

| Variable | Rule | Default |
| --- | --- | --- |
| `SESSION_SECRET` | Required, at least 32 characters | None: startup fails without it (user decision) |
| `MOCK_DB_PATH` | Non-empty string | `.data/db.json` |
| `MOCK_ALLOW_SCENARIO_OVERRIDE` | `"true"` / `"false"` → boolean | `false` |
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS` | `"true"` / `"false"` → boolean | `false` |

`getEnv()` parses `process.env` once and caches the result. `next.config.ts` calls it, so `next dev` and `next build` fail at startup with a readable list of the invalid variables. `.env.example` holds every variable with a placeholder secret, and the README step (SPEC 09) is `cp .env.example .env.local`. The file does not import `server-only`, because `next.config.ts` loads it outside the React server condition.

### Database (`src/server/db/`)

```ts
interface DatabaseSnapshot {
  schemaVersion: 1;
  users: User[]; wallets: Wallet[]; movements: Movement[];
  contacts: Contact[]; transfers: Transfer[]; idempotencyKeys: IdempotencyRecord[];
}
interface IdempotencyRecord {
  key: string; userId: UserId; payloadHash: string; transferId: TransferId; createdAt: string;
}
interface Database {
  read<T>(work: (repositories: Repositories) => T): Promise<T>;
  transaction<T>(work: (repositories: Repositories) => T): Promise<T>;
}
```

- `createJsonDatabase(filePath, createSeed)` is the only implementation. `read` parses the file. `transaction` waits for the lock, re-reads the file, runs `work` against an in-memory snapshot and writes the whole snapshot with a temporary file plus `rename`. If `work` throws, nothing is written.
- The lock is a promise chain stored on `globalThis` under a `Symbol.for` key. Next can load the same module more than once in one process (server components, route handlers and server actions), and a module-level lock would then be duplicated.
- If the file does not exist, it is created from the seed. If `schemaVersion` differs from `1`, it is regenerated from the seed.
- `Repositories` groups `users`, `wallets`, `movements`, `contacts`, `transfers` and `idempotency`. Each one is a small object of synchronous functions over the snapshot (`findById`, `findByPhone`, `insert`, …). Services only see `Database` and `Repositories`, never the file, so replacing JSON with a real store touches neither services nor UI.

### Seed (`src/server/db/seed.ts`)

`createSeed(now: Date): Promise<DatabaseSnapshot>` builds the data relative to `now`, with password hashes computed at creation.

| User | Phone | Email | Password | Balance | Movements | Favorites |
| --- | --- | --- | --- | --- | --- | --- |
| Mariana López | 5512345678 | mariana@spin.test | `Spin2026` | $12,450.80 | 25, spread over the last 30 days, all four types | 4 |
| Diego Ramírez | 5587654321 | diego@spin.test | `Spin2026` | $500.00 | 0 | 0 |

Mariana's favorites (user decision: one of each type, plus Diego for the P2P credit):

| Name | Account | Purpose |
| --- | --- | --- |
| Carlos Ruiz | phone `5523456789` (not registered) | External phone transfer |
| Ana Torres | CLABE with prefix `002` and a valid check digit | Bank detection shows "Banamex" |
| Luis García | card `4111111111111111` | Card with a valid Luhn checksum |
| Diego Ramírez | phone `5587654321` | Internal P2P: Diego's wallet gets credited |

The seed balance is stored as is; it is not the sum of the seed movements.

### Passwords and session (`src/server/session/`)

- `hashPassword(password): Promise<string>` uses `scrypt` with a 16-byte random salt and a 64-byte key, stored as `scrypt$<saltBase64>$<hashBase64>`. `verifyPassword(password, stored): Promise<boolean>` compares with `timingSafeEqual`.
- `signSessionToken(payload, secret)` and `verifySessionToken(token, secret, now): Result<SessionPayload, "INVALID" | "EXPIRED">` live in `token.ts`, a pure module. The token is `base64url(JSON payload).base64url(HMAC-SHA256)`. Verification compares with `timingSafeEqual`.
- `SessionPayload = { userId: UserId; issuedAt: string; expiresAt: string }`. The TTL is 30 minutes, absolute (SPEC 00 §11).
- `session.ts`: `SESSION_COOKIE_NAME = "smw_session"`; `getSession(): Promise<SessionPayload | null>`; `requireSession(): Promise<SessionPayload>`, which throws `UnauthorizedError` (user decision); `setSessionCookie(userId)` and `clearSessionCookie()`. Cookie options: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` when `NODE_ENV === "production"`, `maxAge` 1800.

### Services (`src/server/services/`)

Every service is created by a factory that receives `ServiceDependencies = { db: Database; now: () => Date; random: () => number; createId: () => string }`, so tests control time, randomness and IDs. Services return `Result<View, ServiceError>`. They do not throw for expected failures; only `UnauthorizedError` is thrown, by `requireSession`.

| Service | Function | Success | Errors |
| --- | --- | --- | --- |
| `AuthService` | `register(input)` (output of `registerSchema`) | `UserView` | `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_REGISTERED` as `VALIDATION_ERROR` details |
| | `verifyCredentials(input)` (output of `loginSchema`) | `UserView` | `INVALID_CREDENTIALS` |
| `WalletService` | `getSummary(userId)` | `{ user: { id, fullName }, balance }` | `NOT_FOUND` |
| | `listMovements(userId, { cursor?, limit? })` | `{ items: MovementView[], nextCursor }` | `VALIDATION_ERROR` (bad cursor) |
| `ContactService` | `listFavorites(userId)` | `ContactView[]` | — |
| | `create(userId, input)` (output of `newContactSchema`) | `ContactView` | — |
| `TransferService` | `create(userId, input, idempotencyKey)` (output of `createTransferSchema`) | `TransferView` | `VALIDATION_ERROR`, `INSUFFICIENT_FUNDS`, `NOT_FOUND`, `IDEMPOTENCY_CONFLICT` |
| | `getById(userId, transferId)` | `TransferView` | `NOT_FOUND` |
| | `findByIdempotencyKey(userId, key)` | `TransferView` | `NOT_FOUND` |

```ts
type ServiceError =
  | { code: "VALIDATION_ERROR"; details: Record<string, ValidationCode[]> }
  | { code: "INSUFFICIENT_FUNDS"; balance: Money }
  | { code: "INVALID_CREDENTIALS" }
  | { code: "NOT_FOUND" }
  | { code: "IDEMPOTENCY_CONFLICT" };
```

These codes are a subset of SPEC 00's `ApiErrorCode` (plus `INVALID_CREDENTIALS`, which the login Server Action consumes), so SPEC 04 maps them to HTTP without translating.

Views:

- `UserView = { id, fullName, phone, email }`: never the password hash.
- `AccountView = { type, masked, bankName? }`: `masked` comes from `maskAccount`, and `bankName` comes from `detectBank`, only for CLABE.
- `ContactView = { id, name, account: AccountView, isFavorite }`.
- `MovementView = Omit<Movement, "userId">`.
- `TransferView = { id, folio, trackingKey, recipient: { name, account: AccountView }, amount, concept?, status, createdAt }`.

Service rules:

- **Registration:** normalized phone and email must be unique. It creates the user and a wallet with $1,000.00 and **no movements**, so a new user sees the empty state and can send money right away (user decision).
- **Credentials:** `verifyCredentials` looks the user up by phone or email according to `method`. When the user does not exist, it still runs `verifyPassword` against a fixed dummy hash, so both paths take the same time. It always answers `INVALID_CREDENTIALS`, never "user not found".
- **Movements:** newest first by `createdAt`, then `id`. `limit` defaults to 10 and is clamped to 1–50. `nextCursor` is `null` on the last page.
- **Contacts:** `create` normalizes the account with the domain validators. If the user already has a contact with the same account type and number, it returns that contact marked as favorite instead of duplicating it (user decision). Every saved contact is a favorite; `listFavorites` returns them sorted by name.
- **`TransferService.create`** runs entirely inside one `db.transaction`, in this order:
  1. **Idempotency:** `payloadHash` is the SHA-256 of the canonical JSON of the parsed input. Same user, same key and same hash → return the stored transfer. Same key with a different hash → `IDEMPOTENCY_CONFLICT`.
  2. **Resolve the recipient:** `kind: "contact"` must belong to the sender, otherwise `NOT_FOUND`. `kind: "new"` uses the given name and account.
  3. **Self-transfer:** a phone recipient equal to the sender's phone → `VALIDATION_ERROR` with `recipient: ["RECIPIENT_IS_SELF"]`.
  4. **Business rules:** `validateTransfer` against the current balance. `INSUFFICIENT_FUNDS` returns the current balance; the other violations return `VALIDATION_ERROR` with `amountInCents` or `recipient` details.
  5. **Debit:** subtract from the sender's wallet and insert a `transfer_out` movement with `counterpartyName`.
  6. **P2P credit:** if the recipient is a phone that belongs to a registered user, credit that wallet and insert a `transfer_in` movement with the sender's name. CLABE, card and unregistered phones only debit.
  7. **Save the favorite:** if `kind` is `"new"` and `saveAsFavorite` is true, create the contact or reuse a duplicate. It is saved only because the transfer completed (user decision).
  8. **Store** the `Transfer` (`folio` `SPN-` + 8 digits; `trackingKey` `SPIN` + `yyMMdd` + 8 digits, both from `random`) and the idempotency record.

IDs come from `createId` with a type prefix: `usr_`, `wal_`, `mov_`, `ctc_`, `trf_`.

`src/server/container.ts` exports `getServices()`. It builds the four services once, using `getEnv().MOCK_DB_PATH`, `Date`, `Math.random` and `crypto.randomUUID`.

## Implementation plan

Each step leaves typecheck, lint and tests green and is committed on its own. Every file under `src/server/` starts with `import "server-only"`.

1. **Docs for the split.** In `specs/roadmap.md`: 9 milestones, with 03 "Simulated backend core", 04 "HTTP API and observability" (`feature/04-api`), and 05–09 shifted. In SPEC 00, update the §6 `Movement` model and the §17 milestone column. Shift the milestone numbers in `challenge.md` §8.4 and the "UI milestones" range in `CLAUDE.md`.
   - Why: the other sessions read these files, not this chat. The split has to be visible before any code depends on it.

2. **Test environment and env validation.** In `vitest.config.mts`, add two `test.projects`: `dom` (jsdom, everything except `src/server/**`) and `node` (`src/server/**`), plus an alias from `server-only` to `server-only/empty.js`. Create `src/shared/config/env.ts` with tests. Call `getEnv()` from `next.config.ts`. Add `.env.example`, and add `SESSION_SECRET` and `MOCK_DB_PATH` to `.github/workflows/ci.yml` and to the Playwright `webServer.env`.
   - Why: server code needs Node's `fs` and `crypto`, and `server-only` throws outside the React server condition. A missing secret must fail on `npm run dev`, not on the first login.

3. **Domain additions.** Apply the structured `Movement` model with `MOVEMENT_TYPE` and `MOVEMENT_DIRECTION`. Add `wallet/cursor.ts` with tests, and the three new codes with their es-MX messages.
   - Why: the database, the seed and the services all build on these types. The 100 % domain gate keeps applying.

4. **Password hashing.** Create `src/server/session/password.ts` with tests: round trip, wrong password, a tampered hash, and two hashes of the same password that differ (random salt).
   - Why: the seed and the auth service both need it, and it has no other dependency.

5. **Session token.** Create `src/server/session/token.ts` with tests: valid token, tampered payload, tampered signature, expired token, and a malformed string.
   - Why: a pure module that can be tested without Next. It is the security core of the session.

6. **Session cookie helpers.** Create `src/server/session/session.ts` and `src/server/errors.ts` (`UnauthorizedError`), with tests that mock `next/headers`. `getSession` returns `null` with no cookie, a bad cookie or an expired cookie. `requireSession` throws `UnauthorizedError`. `setSessionCookie` writes the cookie with the documented options, and `clearSessionCookie` deletes it.
   - Why: this is the single entry point that SPEC 04 Route Handlers and SPEC 05 Server Actions will call to protect themselves.

7. **JSON database.** Create `src/server/db/schema.ts` (`DatabaseSnapshot`, `IdempotencyRecord`), `src/server/db/json-database.ts` (`createJsonDatabase`, the lock and the atomic write) and `src/server/repositories/*` with tests against a temporary directory: the file is created from a stub seed, a version mismatch regenerates it, a throwing transaction writes nothing, and 20 concurrent transactions that each increment a counter end at 20.
   - Why: concurrency and atomicity are the risks that can corrupt money. They are proven before any service relies on them.

8. **Seed.** Create `src/server/db/seed.ts` with tests: two users, Mariana's balance is 1245080 cents, 25 movements of every type, 4 favorites whose accounts pass the domain validators, Diego with $500.00 and no movements, and the seed passwords verify.
   - Why: E2E and the demo depend on this exact data. Validating the seed accounts with the domain guarantees that the CLABE and the card are real-looking.

9. **Auth service and views.** Create `src/server/services/views.ts` and `auth-service.ts` with tests: registration succeeds with $1,000.00 and no movements, a duplicate phone or email reports its code, login works by phone and by email, and a wrong password and an unknown user both return `INVALID_CREDENTIALS`.
   - Why: SPEC 05 builds login and registration directly on it.

10. **Wallet and contact services.** Create `wallet-service.ts` and `contact-service.ts` with tests: the summary, three pages of Mariana's movements with no duplicates or gaps, an invalid cursor, Diego's empty list, favorites sorted with masked accounts and `bankName`, and a duplicate account reusing the existing contact.
    - Why: these are the read paths of Home and of the recipient step.

11. **Transfer service: core path.** Create `transfer-service.ts` with `create` (steps 1, 2, 4, 5 and 8 of the rules), `getById` and `findByIdempotencyKey`, with tests: success debits and stores the transfer, the three rule violations, an amount equal to the balance, the idempotent replay, the idempotency conflict, a foreign `contactId`, and 10 concurrent transfers that can only afford 5 → exactly 5 succeed and the balance never goes negative.
    - Why: this is where the three PDF rules are decided for real (SPEC 00 §7, point 3).

12. **Transfer service: self-transfer, P2P and favorites.** Add steps 3, 6 and 7, with tests: sending to one's own phone, Mariana → Diego credits Diego and creates his `transfer_in`, CLABE and card only debit, `saveAsFavorite` creates the contact only on success, and a duplicate reuses the existing contact.
    - Why: these are the cross-account effects, and they must stay in the same critical section as the debit.

13. **Container and docs.** Create `src/server/container.ts` (`getServices()`) with a test against a temporary `MOCK_DB_PATH`, and add a "Server core" section to `CLAUDE.md`. It covers the `Database`/`Repositories` boundary, the `ServiceDependencies` injection, the fact that services return views and `Result`, and the `server-only` and node-project test setup.
    - Why: SPEC 04 and 05 start from `getServices()` and need the conventions written down.

## Acceptance criteria

- [x] `roadmap.md` lists 9 milestones, with 04 "HTTP API and observability". SPEC 00 §6 shows the structured `Movement`, and `challenge.md` §8.4 uses the new numbers.
- [x] `npm run dev` without `SESSION_SECRET` fails at startup with a message naming the variable, and `.env.example` exists with every variable.
- [x] Tests under `src/server/**` run in the Vitest `node` project and can import modules that start with `import "server-only"`.
- [x] `encodeCursor` and `decodeCursor` round-trip, and `decodeCursor("not-a-cursor")` returns `INVALID_CURSOR`.
- [x] `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_REGISTERED` and `RECIPIENT_IS_SELF` are in `VALIDATION_CODES`, each with an es-MX message.
- [x] `verifyPassword("Spin2026", await hashPassword("Spin2026"))` is `true`, and the same check with `"spin2026"` is `false`.
- [x] `verifySessionToken` returns `INVALID` for a token with one changed character and `EXPIRED` for one older than 30 minutes.
- [x] `requireSession()` throws `UnauthorizedError` when `smw_session` is missing, tampered or expired.
- [x] With no database file, the first `read` creates it from the seed. A file with `schemaVersion: 0` is regenerated.
- [x] A transaction that throws leaves the file byte-for-byte unchanged.
- [x] 20 concurrent transactions incrementing one counter end at exactly 20.
- [x] The seed has Mariana with 1245080 cents, 25 movements and 4 favorites, and Diego with 50000 cents and no movements.
- [x] A new registration gets a $1,000.00 balance and zero movements. Registering an existing phone reports `PHONE_ALREADY_REGISTERED` on `phone`.
- [x] `verifyCredentials` returns `INVALID_CREDENTIALS` both for a wrong password and for an unknown email.
- [x] Paging Mariana's movements with `limit` 10 returns 10, 10 and 5 items, with no repeated `id`, and the last page has `nextCursor: null`.
- [x] `listFavorites` for Mariana returns 4 contacts. No `account.masked` contains more than 4 digits, and Ana's has `bankName: "Banamex"`.
- [x] A transfer for exactly Mariana's balance succeeds and leaves the balance at 0. One cent more returns `INSUFFICIENT_FUNDS` with the current balance.
- [x] Repeating `create` with the same key and payload returns the same `TransferView.id` and debits once. The same key with another amount returns `IDEMPOTENCY_CONFLICT`.
- [x] 10 concurrent transfers of $2,000.00 on a $10,000.00 balance produce exactly 5 successes and a final balance of 0.
- [x] A transfer to the sender's own phone returns `VALIDATION_ERROR` with `recipient: ["RECIPIENT_IS_SELF"]`.
- [x] A transfer from Mariana to Diego's phone increases Diego's balance by the same amount and creates a `transfer_in` movement with `counterpartyName: "Mariana López"`.
- [x] A `kind: "new"` transfer with `saveAsFavorite: true` that fails on balance creates no contact.
- [x] No service return value contains `passwordHash`, a full CLABE or a full card number (tested on `UserView`, `ContactView` and `TransferView`).
- [x] `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100 % on `src/domain/**`, 80 % on `src/server/**`) and `npm run build` finish with no errors.
- [x] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** split milestone 03 into the server core (03) and the HTTP layer with observability (04) (user decision). It touched five areas. Each half fits one plan and one PR.
- **Yes:** structured movements (`counterpartyName`, `merchantName`) and labels composed in the UI (user decision). The backend never produces Spanish copy, so the "every text in message files" rule holds.
- **No:** a Spanish `description` stored in the JSON. It mixes data with presentation and blocks i18n.
- **Yes:** new users start with $1,000.00 and no movements (user decision). They can try the transfer flow right away and still see the empty state.
- **Yes:** Mariana's favorites cover phone, CLABE and card, plus Diego (user decision). One seed exercises every account type and the internal P2P credit.
- **Yes:** `requireSession()` throws `UnauthorizedError`, and `getSession()` returns `null` (user decision). The core does not decide how each layer answers: SPEC 04 turns it into a 401, and pages redirect.
- **No:** `redirect("/login")` inside `requireSession`. A Route Handler would answer 307 instead of the 401 that SPEC 00 requires.
- **Yes:** a missing `SESSION_SECRET` fails at startup, and `.env.example` is committed (user decision). No secret lives in the code, not even a development one.
- **No:** a development default secret. It would be a known signing key, and it hides misconfiguration until production.
- **Yes:** a new recipient is saved as a favorite inside the transfer's critical section, only when the transfer completes (user decision). No orphan contacts from abandoned or failed transfers.
- **Yes:** a duplicate contact returns the existing one (user decision). Saving twice is harmless and never shows an error.
- **Yes:** services return masked views. Server Components and Route Handlers both call services, so masking at the source is the only place that covers both.
- **Yes:** services return `Result` and only `requireSession` throws. This matches the domain convention, and expected failures stay in the type system.
- **Yes:** a `Database` interface with `read` and `transaction` over synchronous repositories. Services never see the file, so a real database can replace the JSON without touching them.
- **Yes:** the lock lives on `globalThis`. Next can instantiate a module more than once per process, and two locks would allow lost writes.
- **Yes:** re-read the file inside every transaction instead of caching it in memory. The file is small, and this stays correct even if two module instances exist.
- **Yes:** inject `now`, `random` and `createId` into the services. Deterministic tests for dates, folios and IDs, with no global mocks.
- **Yes:** a dummy-hash comparison when the user does not exist. Response time does not reveal whether an account exists.
- **Yes:** self-transfer is detected only by phone. CLABE and card accounts are external, so they cannot belong to the sender in this model.
- **Yes:** Vitest projects (`dom` and `node`) instead of a per-file environment comment. The project rule forbids comments, and the config makes the split explicit.
- **No:** the scenario engine in this spec. Scenarios simulate HTTP behavior (delays, 503, timeouts), so they belong with the Route Handlers in 04.

## Risks

| Risk | Mitigation |
| --- | --- |
| `next.config.ts` runs before `.env.local` is loaded, so `getEnv()` sees nothing | Step 2 verifies it with `npm run dev`. If it fails, validation moves to `instrumentation.ts` `register()` in SPEC 04, and this spec's criterion is checked on first request instead |
| Next loads server modules twice, so two locks guard one file | The lock lives on `globalThis` behind `Symbol.for`, and every transaction re-reads the file |
| scrypt makes the server test suite slow | Seed and service tests share one seeded snapshot per file. If it is still slow, `hashPassword` receives the scrypt cost as a parameter, with a lower value in tests |
| Concurrency tests pass by luck | They launch every call with `Promise.all` before awaiting any of them, and assert exact final values, not "no error" |
| Seed dates relative to `now` make tests flaky | `createSeed` receives `now` and tests pass a fixed date |

## What is **not** in this spec

- Route Handlers, the error envelope, CSRF and HTTP status mapping (SPEC 04).
- The scenario engine, `mock_scenario`, `mock_read_scenario` and artificial delays (SPEC 04).
- `proxy.ts`, `x-request-id`, the logger, `ErrorReporter` and `instrumentation.ts` (SPEC 04).
- Server Actions, the route guard, the login rate limit and security headers (SPEC 05).
- UI and `Intl` formatting (SPEC 05 onwards).
- Durable or multi-instance persistence.

Each of them lands in the milestone listed in `specs/roadmap.md` after step 1.
