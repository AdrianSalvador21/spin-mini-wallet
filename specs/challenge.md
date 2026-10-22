# Challenge brief and design reference

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-10-21
> **Objective:** Keep the original challenge requirements and the approved visual design inside the repo, so every spec session starts from the same source material.

## How to use it

- Read this file before writing or implementing any spec. It is the source the specs are derived from, not a spec to implement.
- `00-architecture.md` turns these requirements into technical contracts. When the two disagree, SPEC 00 wins, because it was decided later and with more context.
- UI milestones (05 to 08) must follow the design in [`design/mini-wallet-design.html`](./design/mini-wallet-design.html). It is also published as a Claude artifact: https://claude.ai/artifact/LTCjdMCcyowCVxe9RZqSbr (private, owner only). The repo copy is the durable one.

## 1. Source

- Document: `Web Challenge.pdf` ("Web Challenge — Mini Wallet Web App"), from Spin by OXXO (FEMSA). The original lives outside the repo, on the author's machine.
- Received: 2026-10-21. Deadline: **3 calendar days** from receipt, so the repository link is due by 2026-10-24.
- Delivery: send the repository link. If the repository is private, grant access to the email the People team provides.
- The next stage may include live questions about the decisions and **live code changes**. Every decision must be explainable by the author, not only by the AI.

## 2. The challenge

Build a **Next.js + TypeScript** web app that simulates a basic wallet flow:

**Login → Home → New transaction → Confirmation / Receipt**

- Data is mocked. No real services are connected.
- What is evaluated is how real web-development decisions are solved: typing, architecture, state, permissions, error handling and reusable components.
- Context given by the brief: the system runs in a high-volume environment with millions of active users. Design decisions must consider scalability and maintainability.

## 3. Required screens

### 3.1 Login

| Aspect | Requirement |
| --- | --- |
| Form | Phone or email |
| Validation | Input format and required fields |
| States | Loading and simulated error |
| Session | Simple mocked session persistence |
| Navigation | Go to Home after a successful login |

Real security and real authentication are not expected. The brief evaluates structure, state, validation, navigation and separation of responsibilities.

### 3.2 Home

| Aspect | Requirement |
| --- | --- |
| Data | Available balance and user name (mocked) |
| Movements | List of recent movements |
| States | Loading, empty and error |
| Action | Button to start a new transaction |

Evaluated here: component composition, lists, state, responsive design and asynchronous data handling.

### 3.3 New transaction

Base functionality:

- Enter an amount.
- Pick a contact from the favorites list, or enter a new contact manually and save it (mocked).
- Show a summary before confirming.
- Confirm the transaction with a mocked response.
- Show a receipt or success screen.

### 3.4 Confirmation

The confirmation must behave **randomly** and handle every scenario, not only the happy path:

| Scenario | Expected behavior |
| --- | --- |
| Success | Transaction confirmed, show the receipt |
| Network error | Error state with a retry option |
| Insufficient funds | Descriptive error |
| Timeout | Handle the excessive wait |
| Unknown error | Generic fallback |

## 4. Business rules

These validations must run **before** the transaction is confirmed:

1. **Minimum amount:** zero and negative amounts are not allowed.
2. **Sufficient balance:** the amount cannot exceed the available balance.
3. **Required recipient:** the transaction cannot be confirmed without a recipient.

The brief states that how and where these rules are implemented is part of the evaluation.

## 5. Technical requirements

| Aspect | Requirement |
| --- | --- |
| Framework | Next.js + TypeScript |
| Rendering | SSR, CSR or a mix per page, with the decision justified |
| Navigation | Pages Router or App Router |
| State | Free choice (Context, Zustand, Redux…), justified |
| Services | API routes with mocked data |
| Testing | Unit tests for validations, hooks and critical components are valued |
| E2E | E2E with Playwright or another runner, justified |
| Documentation | `README.md` with clear instructions to run the project |

## 6. Deliverables

1. Source code in a Git repository.
2. `README.md`: how to run the project, libraries used, known limitations, and the **real time spent** on the challenge.
3. `DECISIONS.md`: why the project is structured this way, how UI and business logic are separated, which edge cases were considered, and what would be done differently with more time.
4. `AI_USAGE.md`, answering three questions:
   - Which AI tools were used, and in which parts of the project.
   - What was accepted directly, and what was corrected or rejected.
   - Which decisions the author made, not the AI.

Anything extra (tests, capability abstractions, advanced state handling) is welcome and counts according to the level applied for.

## 7. What is valued

- **Intentional TypeScript:** clear types, domain models, no `any`, well-defined contracts.
- **React composition:** clean components, hooks, UI/logic separation, conditional rendering.
- **Rendering experience:** SSR, CSR and Server Actions.
- **Services:** use of API Routes.
- **Business rules:** validations in the right place, not only in the UI.
- **Pragmatism:** simple and extensible solutions, without over-engineering.
- Production-quality code: the best practices the author knows.

These criteria are the yardstick for every spec decision. When two options are equivalent, pick the one that shows one of these criteria more clearly.

## 8. Design reference

Approved on 2026-10-21, before SPEC 00 was written. Tokens were taken from the production CSS of spinbyoxxo.com.mx. Mobile-first, light theme, es-MX copy.

### 8.1 Foundations

- Tokens, typography, radii and breakpoints are in SPEC 00 §14 and already live in `src/app/globals.css`.
- One orange (`brand-orange`) button per screen: it marks the main action. Purple carries structure and navigation.
- Pill buttons (`radius-pill`) in the variants `primary`, `secondary` (outlined purple), `ghost` and a disabled state. The loading state shows a spinner and blocks double submission.
- Fields: label above, 50 px control, optional prefix (`+52`), hint and inline error; focus ring in lavender and error ring in red.
- Segmented control for exclusive choices (Celular / CLABE / Tarjeta, phone / email).
- Alerts in four tones: `danger`, `warning`, `success` and `info`, each with an icon.
- Skeletons shaped like the real content, so the layout does not jump (CLS).
- Amounts in Montserrat 800 with `tabular-nums`. Credits are green **and** carry an explicit `+` sign; debits use ink and a `−` sign. Color alone never carries meaning.

### 8.2 Screens

| Screen | Key elements |
| --- | --- |
| Login | Purple gradient header with logo, "Hola de nuevo"; phone with `+52` prefix and `inputMode="tel"` by default; a link switches the same form to email without changing route; server error above the form with `role="alert"`; field errors inline; "¿No tienes cuenta? Regístrate" footer |
| Register | App bar with back button, "Crea tu cuenta"; full name, phone, email, password (policy hint) and confirmation; one "Crear cuenta" CTA |
| Home | Gradient header with "Hola," and name plus initials avatar; floating balance card with an **eye icon to hide the balance**, "Enviar dinero" CTA; "Movimientos recientes" list with icon per type, title, relative date and signed amount; "Ver más movimientos" pill |
| Home states | Loading skeleton for header, balance and list; empty state "Aún no tienes movimientos" (Diego); partial error "No pudimos cargar tus movimientos" with "Reintentar" and a "Referencia" request id, while the balance stays visible |
| Transfer 1/3 · Amount | App bar "Enviar dinero" with step counter and three-segment progress bar; large centered amount; available balance below; **quick chips `$100`, `$200`, `$500`, `Todo`**; inline danger alert when a rule fails and a disabled "Continuar" |
| Transfer 2/3 · Recipient | "¿A quién le envías?"; horizontal favorites row with initials avatars, a dashed "Nuevo" item and an orange ring on the selected one; selected card shows name and masked account |
| Transfer 2b · New contact | Segmented Celular / CLABE / Tarjeta; recipient name; account field; hint "Banco detectado: <bank>" for CLABE; "Guardar en favoritos" checkbox |
| Transfer 3/3 · Review | "Revisa tu envío"; amount; rows Para, Cuenta, Concepto, **Comisión $0.00**, **Saldo después**; "Confirmar envío" and a ghost "Editar datos" |
| Processing | Spinner ring, "Enviando $X a <name>", "No cierres esta ventana"; DEV scenario panel floating at the bottom |
| Success / receipt | Card with success icon, "¡Envío exitoso!", amount, date, rows Para, Cuenta, Folio (`SPN-48213907` format), Clave de rastreo; "Compartir comprobante" (secondary) and "Volver al inicio" (primary) |
| Network error | "Se perdió la conexión", states that no charge was made; "Reintentar envío" + "Volver al inicio"; reference id |
| Insufficient funds | "Saldo insuficiente", explains the balance changed, shows current balance and transfer amount; "Cambiar monto" + "Volver al inicio" |
| Timeout | Warning tone, "Está tardando más de lo normal"; asks to check before retrying; "Revisar estado del envío" + "Volver al inicio"; reference id |
| Unknown error | "Algo salió mal", share the reference with support; "Volver al inicio"; reference id |
| Desktop (≥ 1024 px) | Three zones: purple side navigation (Inicio, Enviar dinero, Contactos, Cerrar sesión at the bottom), main column with greeting and movements, right column with balance, "Enviar dinero" and favorites |

### 8.3 Where SPEC 00 overrides the design

The design came first. These points were decided differently afterwards, and the SPEC 00 version is the one to build:

| Topic | Design said | Build this (SPEC 00) |
| --- | --- | --- |
| Receipt route | `/transfers/[id]/receipt` | `/transfers/[transferId]` |
| Forcing a scenario in tests | A request header | The `mock_scenario` cookie, honored only with `MOCK_ALLOW_SCENARIO_OVERRIDE=true` |
| When the DEV panel renders | `NODE_ENV !== "production"` or a flag | Only with `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` |
| UI primitives folder | `src/components/ui/` | `src/shared/ui/` |

### 8.4 Design details not yet assigned to a spec

The design shows them, but SPEC 00 does not mention them. The spec of the listed milestone decides whether they ship. If it drops one, it records why in its Decisions section.

| Detail | Milestone that decides |
| --- | --- |
| Hide-balance eye icon on Home | 06 |
| "Filtrar" link on the desktop movements list | 06 |
| "Contactos" item in the desktop side navigation | 06 |
| Quick amount chips (`$100`, `$200`, `$500`, `Todo`) | 07 |
| "Comisión $0.00" and "Saldo después" rows in the review | 07 |
| "Compartir comprobante" on the receipt | 08 |
