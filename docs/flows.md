# Data flows

What happens, step by step, in the three flows a reviewer is most likely to question: logging in, loading Home, and sending money, including the failure paths. Layers and data shapes are in [Architecture](./architecture.md); client state is in [State](./state.md).

## Contents

- [Login](#login)
- [Home](#home)
- [Transfer](#transfer)
  - [Success](#success)
  - [Network error and retry](#network-error-and-retry)
  - [Timeout and status lookup](#timeout-and-status-lookup)

## Login

Login and registration are **Server Actions**, not REST endpoints: they set a cookie and redirect, and they live next to the form that uses them. The form validates with the same Zod schema on the client (instant feedback) and the server (the check that decides).

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant F as LoginForm (client)
  participant A as loginAction (Server Action)
  participant L as Rate limiter
  participant S as AuthService
  participant DB as JSON database

  U->>F: phone or email + password
  F->>F: zodResolver(loginSchema): format and required fields
  F->>A: raw values (startTransition)
  A->>A: loginSchema.safeParse again
  A->>L: blocked? (5 failures / 15 min per identifier)
  alt blocked
    A-->>F: { kind: rate_limited }
  else allowed
    A->>S: verifyCredentials
    S->>DB: find user by phone or email
    S->>S: scrypt + timingSafeEqual (dummy hash when the user is missing)
    alt wrong credentials
      S-->>A: INVALID_CREDENTIALS
      A->>L: count the failure
      A-->>F: { kind: invalid_credentials } (never says whether the user exists)
    else valid
      A->>L: reset the counter
      A->>A: set smw_session (HMAC-signed, httpOnly, 30 min)
      A-->>U: redirect /home
    end
  end
```

The session is a signed cookie, so any server instance can verify it without shared state. `proxy.ts` redirects pages based on it; Route Handlers and Server Actions check it again (`requireSession()`), so the proxy is never the only barrier.

## Home

Home renders on the server and **streams**: the static shell is sent at once, and the balance and the movements arrive as two independent `<Suspense>` sections. Their data is handed to TanStack Query on the client, so pagination continues without repeating the first load.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant P as proxy.ts
  participant LY as Private layout
  participant SS as SummarySection (RSC)
  participant MS as MovementsSection (RSC)
  participant HL as HomeLoader
  participant WS as WalletService
  participant API as /api/v1/wallet/movements

  B->>P: GET /home (smw_session)
  P->>P: valid signature and expiry? else redirect /login
  P->>LY: x-request-id
  LY->>LY: SessionGuard: user still exists? else /session/end
  LY-->>B: static shell + two skeletons (streamed)
  par balance
    SS->>HL: loadSummary(user, mock_read_scenario)
    HL->>WS: getSummary
    SS-->>B: HydrationBoundary(summary) + header and balance card
  and movements
    MS->>HL: loadMovements(user, direction from URL)
    HL->>WS: listMovements (first page of 10)
    MS-->>B: HydrationBoundary(page 1) + list
  end
  B->>B: TanStack Query hydrates both caches (no refetch)
  B->>API: "Ver más" → GET ?cursor=… (client)
  API-->>B: next page, nextCursor
```

- **Partial failure.** Each section has its own `<Suspense>` and error boundary. If the movements fail, the balance stays visible. A failed server load is left out of the hydration, so the client query fetches by itself and one error state (with "Reintentar" and a reference id) covers both cases.
- **Demonstrable states.** The `mock_read_scenario` cookie (`slow`, `error`, `movements_error`) drives the same loading and error states on the server and in the API, so the reviewer can see them from the DEV panel.
- **Filter in the URL.** "Todos / Enviados / Recibidos" lives in `?direction=`, changed with `history.pushState`, so reload and back keep it.

## Transfer

The wizard keeps a draft on the client and validates each step with the domain rules. The server validates again before the scenario draw and once more inside the write lock.

```mermaid
flowchart LR
  A["1 · Monto<br/>parseAmount + rules 1 and 2"] --> R["2 · Destinatario<br/>favorite or new contact<br/>(saved first: POST /contacts)"]
  R --> V["3 · Revisión<br/>validateTransfer (3 rules)<br/>creates the Idempotency-Key"]
  V -->|Confirmar envío| P["Procesando<br/>POST /transfers, 8 s timeout"]
  P -->|201| OK["Comprobante<br/>/transfers/[id]"]
  P -->|503 or no connection| NE["Se perdió la conexión<br/>retry with the same key"]
  P -->|422| IF["Saldo insuficiente<br/>shows the current balance"]
  P -->|8 s without answer| TO["Está tardando más de lo normal<br/>status lookup"]
  P -->|500 or anything else| UE["Algo salió mal<br/>reference id"]
```

On the server, `POST /api/v1/transfers` always runs its checks in this order, so invalid input never gets a simulated answer and a retry never charges twice:

1. CSRF (`Origin` and `Content-Type`) and session.
2. `Idempotency-Key` format, then the payload schema (integer cents, at most $999,999.99).
3. **Idempotency replay:** a key that already completed returns the stored transfer, with no new draw and no new debit.
4. **Business pre-check:** the contact belongs to the user, it is not the user's own phone, and the three rules pass against the real balance.
5. **Scenario draw:** 60 % success, 10 % each for network error, insufficient funds, timeout and unknown error (or the `mock_scenario` cookie).
6. On success, `TransferService.create` re-checks everything inside the lock, debits, writes the movement (and the P2P credit) and stores the key.

### Success

```mermaid
sequenceDiagram
  autonumber
  participant C as Review (client)
  participant H as POST /api/v1/transfers
  participant TS as TransferService
  participant DB as JSON database

  C->>C: submit(draft): status processing, dialog opens
  C->>H: body + Idempotency-Key K + x-request-id R1
  H->>TS: findByIdempotencyKey(K) → not found
  H->>TS: check(user, body) → ok
  H->>H: scenario = success, wait 600–1200 ms
  H->>TS: create(user, body, K)
  TS->>DB: lock → re-check → debit → movement(s) → transfer → key K
  TS-->>H: TransferView (masked)
  H-->>C: 201
  C->>C: invalidate wallet queries, router.replace(/transfers/id)
```

### Network error and retry

```mermaid
sequenceDiagram
  autonumber
  participant C as Review (client)
  participant H as POST /api/v1/transfers

  C->>H: Idempotency-Key K, x-request-id R1
  H-->>C: 503 UPSTREAM_UNAVAILABLE (nothing debited, K not stored)
  C->>C: "Se perdió la conexión", reference R1
  C->>H: Reintentar envío: same K, new x-request-id R2
  H->>H: replay? no → check → new draw
  H-->>C: 201 (or another outcome)
```

The key is created when the review step mounts and survives a reload and "Volver al inicio". It changes only when the amount, the concept or the recipient change, because the server answers `409` to the same key with a different payload.

### Timeout and status lookup

The `timeout` scenario makes the server wait 12 s and then complete the transfer. The client gives up at 8 s. At that moment the result is unknown, so the app never retries blindly and never says it failed.

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant H as POST /api/v1/transfers
  participant G as GET /api/v1/transfers?idempotencyKey=K
  participant TS as TransferService

  C->>H: K, R1
  Note over H: scenario = timeout, waits 12 s
  Note over C: 8 s: AbortController aborts
  C->>C: "Está tardando más de lo normal", reference R1
  C->>G: Revisar estado del envío (at about 9 s)
  G->>TS: findByIdempotencyKey(K)
  TS-->>G: not found yet
  G-->>C: 404 → "Todavía no encontramos tu envío"
  Note over H,TS: 12 s: create(K) debits and stores K
  C->>G: Revisar de nuevo
  G-->>C: 200 TransferView → receipt
```

If the user retries instead of checking, the request carries the same key: the replay check finds the completed transfer and returns it, so the money moves once.
