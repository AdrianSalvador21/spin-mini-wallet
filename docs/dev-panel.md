# DEV scenario panel

The DEV panel is a small floating pill on every private page (Home, the transfer wizard and the receipt). It lets you force how the mocked backend answers, so every state of the app can be shown on demand instead of waiting for the random draw:

- the five transfer outcomes that `POST /api/v1/transfers` picks at random (60 / 10 / 10 / 10 / 10);
- the loading and error states of the read endpoints (balance, movements and contacts).

It is a demo and QA tool. It never changes data by itself: it only writes two cookies that the server reads on the next request.

## Contents

- [Enable it](#enable-it)
- [Where it is and how to move it](#where-it-is-and-how-to-move-it)
- [Controls](#controls)
- [Use cases](#use-cases)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)

## Enable it

The panel renders only when **both** variables are `true` in the server's environment:

| Variable | Why it is needed |
| --- | --- |
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` | Shows the panel |
| `MOCK_ALLOW_SCENARIO_OVERRIDE=true` | Makes the server honor the scenario cookies. Without it the cookies are ignored, so the panel stays hidden instead of pretending to work |

Locally, set both in `.env.local` and restart the server:

```bash
# .env.local
MOCK_ALLOW_SCENARIO_OVERRIDE=true
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
```

```bash
npm run dev
```

On a deployment (Vercel), add both variables to the project's environment and redeploy.

The private layout reads them on every request, so with `next start` a restart is enough; no rebuild is needed.

Sign in with a seed user to see it:

| User | Mobile | Password | Useful for |
| --- | --- | --- | --- |
| Mariana López | `5512345678` | `Spin2026` | Balance $12,450.80, movements and three favorites |
| Diego Ramírez | `5587654321` | `Spin2026` | Balance $500.00 and no movements (empty states) |

Playwright always runs with `NEXT_PUBLIC_ENABLE_DEV_TOOLS=false`. E2E tests set the same cookies directly, so a local `.env.local` never puts the pill over a button they click.

## Where it is and how to move it

| Viewport | Default place | Can it move? |
| --- | --- | --- |
| Below 1024 px (mobile and tablet) | Bottom left, 168 px above the bottom edge, so it clears the review's two-button action bar | **Yes.** Press and drag it anywhere on the screen |
| From 1024 px (desktop) | Bottom right, 16 px from both edges | No. It stays fixed there |

Dragging, below 1024 px:

- Press the pill and move your finger or mouse. It follows the pointer and never leaves the screen: it stops 8 px from every edge.
- A press that moves less than 6 px counts as a tap, so it opens or closes the panel instead of moving it.
- The page does not scroll while you drag the pill.
- The position is remembered in this browser (`localStorage`, key `smw.dev-panel-position`). It survives reloads, navigation and logging out. If the window gets smaller, the pill is pushed back inside the screen.
- The settings card opens toward the free space. If the pill is in the bottom half of the screen, the card opens above it; in the top half, below it. If the pill is in the left half, the card aligns to its left edge; in the right half, to its right edge.
- To put the pill back in its default place, delete `smw.dev-panel-position` in DevTools → Application → Local Storage and reload.

On desktop, a position stored on mobile is ignored, and the card always opens above the pill, aligned to the right.

## Controls

The collapsed pill reads **DEV** plus the active transfer scenario, for example **DEV Aleatorio** or **DEV Tiempo de espera**. Tap it to open the card **Escenarios simulados**; tap it again to close it.

| Control | Options | Cookie it writes |
| --- | --- | --- |
| **Envío** | **Aleatorio** (removes the cookie, so the server picks at random), **Éxito**, **Error de red**, **Saldo insuficiente**, **Tiempo de espera**, **Error desconocido** | `mock_scenario` = `success` / `network_error` / `insufficient_funds` / `timeout` / `unknown_error` |
| **Lecturas** | **Normal** (removes the cookie), **Lento**, **Error**, **Error en movimientos** | `mock_read_scenario` = `slow` / `error` / `movements_error` |
| **Restablecer** | — | Removes both cookies |

When does a change apply?

- **Envío** applies the next time you press **Confirmar envío**, **Reintentar envío** or a status check. Nothing reloads.
- **Lecturas** and **Restablecer** also refetch every query on screen at once, so Home or the wizard shows the new state without a reload.

## Use cases

Every case below starts signed in as Mariana, with the panel enabled. To reach the review step:

1. Go to **Inicio** and press **Enviar dinero**.
2. Type an amount (for example `100`) and press **Continuar**.
3. Choose **Carlos Ruiz** and press **Continuar**.

You are now on **Revisa tu envío**.

### Transfer outcomes

| # | Use case | Steps | Expected result |
| --- | --- | --- | --- |
| T1 | Successful transfer | **Envío → Éxito**. Reach the review and press **Confirmar envío** | A modal **"Enviando $100.00 a Carlos"** with a spinner. After about 1 s the browser lands on `/transfers/trf_…`, showing **¡Envío exitoso!**, the amount, the date ("22 oct 2026, 10:42 h"), **Para**, **Cuenta**, **Folio** (`SPN-` + 8 digits) and **Clave de rastreo** |
| T2 | The receipt survives a reload and back | After T1, reload the page, then press the browser's back button | The reload shows the same receipt. Back does not return to the review |
| T3 | Home updates after a success | After T1, press **Volver al inicio** | The balance is $100.00 lower and the new **Envío a Carlos Ruiz** movement is on top, without a manual reload. That movement is a link to its receipt. **Enviar dinero** starts with an empty amount |
| T4 | Network error and retry | **Envío → Error de red**. Confirm a transfer | **Se perdió la conexión** with **Reintentar envío**, **Volver al inicio** and **Referencia: …** with **Copiar**. No charge, and Home's balance is unchanged |
| T5 | Retrying never charges twice | After T4, switch **Envío → Éxito** and press **Reintentar envío** | The receipt appears. Home shows exactly **one** new movement for that transfer, because the retry reuses the same `Idempotency-Key` |
| T6 | Insufficient funds | **Envío → Saldo insuficiente**. Confirm a transfer | **Saldo insuficiente**, showing the available balance and **Cambiar monto** and **Volver al inicio**. No reference is shown, as in the design. The simulated case says "No pudimos completar el envío por falta de saldo. Tu saldo disponible es $…", because the real balance covers the amount |
| T7 | Change the amount after insufficient funds | After T6, press **Cambiar monto** | The amount step opens with the previous amount still typed |
| T8 | Timeout | **Envío → Tiempo de espera**. Confirm a transfer | The **Enviando…** modal for about 8 s, then **Está tardando más de lo normal** with **Revisar estado del envío**, **Volver al inicio** and a reference |
| T9 | Status check before the server finishes | Right after T8 appears, press **Revisar estado del envío** | **Todavía no encontramos tu envío** with **Revisar de nuevo**, **Reintentar envío**, **Volver al inicio** and a reference. The server is still processing (it commits at 12 s) |
| T10 | Status check after the server finishes | Wait about 5 s more and press **Revisar de nuevo** | The receipt appears, and Home shows exactly **one** movement for it |
| T11 | Retry from "not found yet" | In T9, switch **Envío → Éxito** and press **Reintentar envío** instead | The receipt appears with **one** movement. If the slow first request finishes afterwards, it returns the same transfer instead of charging again |
| T12 | Unknown error | **Envío → Error desconocido**. Confirm a transfer | **Algo salió mal** with only **Volver al inicio** (the single orange button) and a reference |
| T13 | Draft and key survive leaving a failure | After T4, T8 or T12, press **Volver al inicio**, then **Enviar dinero** and go to the review again | The same amount and recipient are still there. DevTools → Application → Session Storage → `smw.transfer-draft` keeps the same `idempotencyKey`, so a later confirmation cannot pay twice |
| T14 | Random again | **Envío → Aleatorio**. Confirm a few transfers | The `mock_scenario` cookie is gone and the outcomes follow the 60 / 10 / 10 / 10 / 10 draw |

Each failure screen hides the wizard's app bar, stepper and **Cancelar**, moves focus to its title and has exactly one orange button.

### Read scenarios

| # | Use case | Steps | Expected result |
| --- | --- | --- | --- |
| R1 | Slow load | On Home, **Lecturas → Lento** | The balance and movements show their skeletons for about 3 s, then load normally |
| R2 | Everything fails | On Home, **Lecturas → Error** | The balance and movements both show their error state with **Reintentar** and **Referencia: …**. The wizard's amount step also shows the balance error |
| R3 | Only movements fail | On Home, **Lecturas → Error en movimientos** | The balance is visible; only the movements block shows **No pudimos cargar tus movimientos** with **Reintentar** |
| R4 | Back to normal | **Lecturas → Normal**, or press **Reintentar** after choosing it | Everything loads again. The `mock_read_scenario` cookie is gone |
| R5 | Error on the first load | Choose **Lecturas → Error** and reload Home | The error states appear on the server-rendered first load too, not only after a client refetch |
| R6 | Contacts fail | **Lecturas → Error**, then open the recipient step | **No pudimos cargar tus contactos** with **Reintentar** and a reference |

The receipt (`/transfers/[transferId]`) is never affected by **Lecturas**: after a real success it always shows.

### Panel behavior

| # | Use case | Steps | Expected result |
| --- | --- | --- | --- |
| P1 | Reset | Choose any **Envío** and **Lecturas**, then **Restablecer** | Both cookies are removed, the selects show **Aleatorio** and **Normal**, the pill reads **DEV Aleatorio**, and the screen refetches |
| P2 | Persistence | Choose **Envío → Error de red** and reload | The pill still reads **DEV Error de red**, because it reads the cookie |
| P3 | Copy a reference | On any screen with **Referencia: …**, press **Copiar** | The label turns into **Copiado** for 2 s and the id is on the clipboard |
| P4 | Drag on mobile | Below 1024 px, drag the pill to the top right | It follows the pointer, stays 8 px inside the screen and does not open. Tapping it now opens the card below it, aligned to its right edge |
| P5 | Position is remembered | After P4, reload or log out and back in | The pill is where you left it |
| P6 | Fixed on desktop | From 1024 px, try to drag the pill | It does not move. It stays at the bottom right, and a tap opens the card above it |
| P7 | Hidden without a flag | Set either variable to `false` and restart | No pill on any page |

## How it works

| Piece | Where |
| --- | --- |
| Panel UI | `src/features/dev-tools/components/dev-panel/` |
| Cookie read and write | `src/features/dev-tools/scenario-cookies.ts` |
| Drag math (clamp, placement) | `src/features/dev-tools/drag-position.ts`, `hooks/use-draggable-position.ts` |
| Where it is rendered | `src/app/(private)/layout.tsx`, only with both flags |
| Cookie names and values | `SCENARIO_COOKIE`, `TRANSFER_SCENARIO`, `READ_SCENARIO` in `src/shared/lib/api/contract.ts` |
| How the server applies them | `src/server/mock/scenarios.ts` (`resolveTransferScenario`, `resolveReadScenario`, `readOutcome`) |

Server behavior per transfer scenario:

| Scenario | Server answer | Debits? |
| --- | --- | --- |
| `success` | `201` after 600–1200 ms | Yes |
| `network_error` | `503 UPSTREAM_UNAVAILABLE` | No |
| `insufficient_funds` | `422 INSUFFICIENT_FUNDS` with the current balance | No |
| `timeout` | Waits 12 s, then `201`. The client gives up at 8 s | Yes, at 12 s |
| `unknown_error` | `500 INTERNAL_ERROR` | No |

A request whose `Idempotency-Key` already has a completed transfer skips the scenario entirely and returns the stored transfer, so a retry never lands on a fake failure.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| No pill | One of the two variables is not `true`, or the server was not restarted after changing `.env.local` |
| The pill shows a scenario but the outcome is random | `MOCK_ALLOW_SCENARIO_OVERRIDE` is off on the server. The panel would normally be hidden; restart after fixing the variable |
| The pill covers a button on mobile | Drag it somewhere else; it remembers the new place |
| The pill is stuck in a corner | Delete `smw.dev-panel-position` from Local Storage and reload |
| `timeout` never completes on Vercel | The 12 s server wait can outlive a serverless function's limit. Check it locally |
| Scenarios leak into another tab | The cookies are shared by every tab of the same browser. Use **Restablecer** when you are done |
