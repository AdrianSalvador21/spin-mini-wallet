# SPEC 05 — Authentication: login, registration, logout and route guard

> **Status:** Implemented
> **Depends on:** SPEC 00, SPEC 02, SPEC 03, SPEC 04
> **Date:** 2026-10-21
> **Objective:** Build PDF screen 1 (login by mobile or email and registration) on the SPEC 03 session primitives, with the first UI primitives, Server Actions, a login rate limit, the route guard in `proxy.ts` and security headers.

**Branch:** `feature/05-auth` (branched from an up-to-date `develop`, merged back through a PR to `develop`).

## Why this spec exists

SPEC 03 built the session primitives and `AuthService`, and SPEC 04 protected every `/api/v1/*` endpoint with `requireSession()`. Nothing can create a session yet. This milestone is the only way into the app, so it also owns the guard that keeps private pages out of reach and the first E2E run against a real login. SPEC 04 deferred that run to this milestone.

It is also the first UI milestone. The primitives built here (Button, Field, PasswordInput, Alert, Icon, AppBar, Segmented) are reused by SPEC 06–08, so they follow the approved design (`specs/design/mini-wallet-design.html`, summarized in `challenge.md` §8) and the BEM + CSS-variable convention from the start.

**Design update (2026-10-22, user decision).** While step 11 was in review, the design gained two approved sections: the *mobile review* and the *desktop proposal*. This spec adopts everything in them that touches authentication and the primitives (see "Approved design alignment" below and step 12). What they define for the private shell, Home, the wizard and the results is recorded in `challenge.md` §8.4 for SPEC 06–08.

Server Actions follow the same pattern as the SPEC 04 handlers (user decision). The logic lives in factories under `src/server/auth/` that receive their dependencies and return a `Result`. `src/features/auth/actions.ts` only binds them, writes the cookie and calls `redirect()`. Tests inject a fake clock and fake services instead of mocking Next modules.

## Scope

**In:**

- SPEC 00 §11, §14 and §15 and `roadmap.md` updated with the decisions below.
- `zod` as a direct dependency (today it only arrives transitively through `eslint-config-next`), plus `react-hook-form` and `@hookform/resolvers`.
- `--color-info` and `--color-info-bg` tokens, with the design's values.
- `src/shared/lib/routes.ts`: route constants and the pure route-access rule the proxy applies.
- `src/shared/lib/format/phone.ts`: the `55 1234 5678` input mask.
- UI primitives in `src/shared/ui/`: `icon`, `button`, `field`, `password-input`, `alert`, `app-bar`, `segmented` and `action-bar`, each with `.tsx`, `.module.scss` (BEM) and `.test.tsx`.
- The approved mobile review and desktop proposal for auth: segmented method selector, CTA label in `ink-900`, 16 px inputs, 44 px touch targets, purple links, the bottom action bar with `interactiveWidget: "resizes-content"`, and the 50/50 split screen with a brand panel from `lg` for login and registration.
- The auth form contract in `src/shared/lib/auth/form-state.ts`.
- A login rate limiter and the auth action factories in `src/server/auth/`, plus `getAuthActions()` in the container.
- Server Actions `loginAction`, `registerAction` and `logoutAction` in `src/features/auth/actions.ts`.
- `/login` and `/register` pages under `src/app/(public)/`, with their client forms in `src/features/auth/components/`.
- A minimal `/home` placeholder with a greeting and a logout button, replaced by SPEC 06 (user decision).
- The route guard in `src/proxy.ts`, the `/` redirect, and the removal of the SPEC 01 landing page.
- Security headers in `next.config.ts`.
- Playwright on its own port and database, and E2E for login, registration, the guard, logout and an authenticated API smoke test.
- An `auth` message namespace and an "Authentication" section in `CLAUDE.md`.

**Out of scope (for future specs):**

- The private shell (top bar, side navigation), the real Home, `error.tsx` and `global-error.tsx` (SPEC 06).
- Skeletons and the transfer wizard (SPEC 06–07). The segmented control moved into this spec with the mobile review.
- The rest of the mobile review and the desktop proposal: the "Mi cuenta" bottom sheet, the icon rail and `xl` sidebar, the 1040 px container, the wizard and result layouts (SPEC 06–08, `challenge.md` §8.4).
- Remembering the requested page across login with `?next=` (user decision: always `/home`).
- An E2E test for the rate limit. Unit tests cover it (user decision).
- Password recovery, OTP, MFA and "remember me" (out of the project, SPEC 00 §2).
- A Content Security Policy. SPEC 00 §11 does not list one, and a nonce-based CSP would interact with Cache Components prerendering.
- A distributed rate limit. It stays in memory, per instance (SPEC 00 §11).

## Data model

### Route constants and access rule (`src/shared/lib/routes.ts`)

```ts
export const ROUTES = {
  ROOT: "/", LOGIN: "/login", REGISTER: "/register", HOME: "/home", TRANSFERS: "/transfers",
} as const;

export const ROUTE_ACCESS = { NEXT: "next", REDIRECT: "redirect" } as const;
export type RouteAccess =
  | { action: typeof ROUTE_ACCESS.NEXT }
  | { action: typeof ROUTE_ACCESS.REDIRECT; to: string };

export function resolveRouteAccess(pathname: string, hasSession: boolean): RouteAccess;
```

| Path | No session | Valid session |
| --- | --- | --- |
| `/` | Redirect to `/login` | Redirect to `/home` |
| `/login`, `/register` | Next | Redirect to `/home` |
| `/home`, `/home/**`, `/transfers`, `/transfers/**` | Redirect to `/login` | Next |
| `/api/**` and anything else | Next | Next |

`/api/**` is never redirected. Route Handlers answer `401` themselves (SPEC 04), and an API client must never receive a `307` to an HTML page.

### Phone mask (`src/shared/lib/format/phone.ts`)

`formatPhoneInput(raw: string): string` keeps only digits, truncates to 10 and groups them 2-4-4 (`"5512345678"` → `"55 1234 5678"`, `"551"` → `"55 1"`). The form keeps the formatted value. `validatePhone` already strips spaces, so the domain does not change (user decision).

### Tokens (`src/app/globals.css`, SPEC 00 §14)

| CSS token | Value | Usage |
| --- | --- | --- |
| `--color-info` | `#3D1199` | Info alert text and icon |
| `--color-info-bg` | `#EEE8FA` | Info alert background |

Scale tokens, added with the first primitives so no SCSS file carries a loose measured value (user decision). Spacing follows Tailwind's 4 px grid; the design's 15/26 px button padding becomes 16/24, its 6 and 10 px gaps become 8, and its 14 px field padding becomes 16. Dimensions and type sizes keep the design's exact values:

| CSS token | Value |
| --- | --- |
| `--space-1/2/3/4/5/6/8` | `4px` / `8px` / `12px` / `16px` / `20px` / `24px` / `32px` |
| `--text-size-xs/sm/md/lg/xl` | `12px` / `13px` / `14px` / `15px` / `21px` |
| `--radius-xl` | `28px` |
| `--size-control` | `50px` |
| `--size-icon-sm/md` | `16px` / `18px` |
| `--size-icon-button` | `32px` |
| `--border-width-thin` / `--border-width` | `1.5px` / `2px` |
| `--focus-ring-width` / `--focus-ring-offset` / `--focus-halo` | `3px` / `2px` / `4px` |
| `--duration-fast` / `--duration-spin` | `150ms` / `1s` |
| `--container-auth` | `420px` |

Tokens from the approved mobile review and desktop proposal (2026-10-22), also in SPEC 00 §14:

| CSS token | Value |
| --- | --- |
| `--color-on-brand-orange` | `var(--color-ink-900)` |
| `--color-success-strong` | `#0E6B4C` |
| `--radius-icon` | `12px` |
| `--space-10/12/14` | `40px` / `48px` / `56px` |
| `--text-size-input` | `16px` |
| `--text-size-lead` / `-2xl` / `-3xl` / `-hero` | `17px` / `28px` / `32px` / `44px` |
| `--size-touch` | `44px` |
| `--size-button-desktop` / `--size-button-min-width` | `48px` / `200px` |
| `--size-icon-tile` / `--size-logo-md` / `--size-logo-lg` | `36px` / `84px` / `104px` |
| `--container-form` | `400px` |

### UI primitives (`src/shared/ui/`)

| Component | Props | Behavior |
| --- | --- | --- |
| `Icon` | `name: IconName`, `size?: IconSize` (`ICON_SIZE` `sm` / `md`, the `--size-icon-*` tokens, default `md`), `label?` | Inline SVG copied from the design's symbols: `alert`, `check`, `clock`, `eye`, `eye-off`, `back`, plus `phone`, `receipt` and `shield` for the brand panel. `ICON_NAME` is an `as const` object. Without `label` it is `aria-hidden`. With `label` it is `role="img"` with `aria-label` |
| `Button` | `variant: ButtonVariant`, `type?: ButtonType`, `block?`, `loading?`, `loadingLabel?`, native button props | Pill shape, at least `--size-control` (50 px) tall on mobile. The primary label is `--color-on-brand-orange` (`ink-900`). From `lg` it is `--size-button-desktop` (48 px) tall and, unless `block`, at least `--size-button-min-width` (200 px) wide. `loading` shows the spinner, sets `aria-busy`, replaces the text with `loadingLabel` and disables the button so it cannot submit twice. `type` defaults to `BUTTON_TYPE.BUTTON` |
| `Field` | `label`, `id`, `type?: InputType`, `inputMode?: InputMode`, `autoComplete?: AutoComplete`, `prefix?`, `suffix?`, `hint?`, `error?`, input props, `ref` | Label above a 50 px control, input text at `--text-size-input` (16 px), optional prefix (`+52`), an optional trailing `suffix` slot, hint and inline error. With `error`, the control gets the error ring, the input gets `aria-invalid="true"`, and `aria-describedby` points to the error (or the hint). Works with RHF's `register` through the React 19 `ref` prop |
| `PasswordInput` | `Field` props without `type` and `suffix` | A `Field` with `type="password"` and a trailing toggle button (`eye` / `eye-off`) with a 44 × 44 hit area, labeled "Mostrar contraseña" / "Ocultar contraseña", with `aria-pressed` |
| `Alert` | `tone: AlertTone`, `role?: AlertRole`, `children` | Tone background and icon (`alert`, `clock`, `check`, `alert`). The success tone uses `--color-success-strong` for text. `ALERT_TONE` and `ALERT_ROLE` are `as const` objects, and the tone → icon mapping is an exhaustive `switch` |
| `AppBar` | `title`, `backHref` | Back link with a 44 × 44 hit area around the 32 px lavender circle (`Icon` `back`, labeled "Regresar") and the title. From `lg` it becomes a purple "Regresar" text link above a 32 px title, as in the desktop register mock. SPEC 07 adds the step counter |
| `Segmented` | `label`, `name`, `options: { value, label }[]`, `value`, `onChange` | Pill track on `lavender-200` with 44 px options; the selected one is white with a soft shadow. Built on native `<input type="radio">` inside a `role="radiogroup"` labeled by `label`, so arrow keys move the selection and the focus stays in the group |
| `ActionBar` | `children`, `className?` | The bottom action bar of a form on mobile: sticky at the bottom edge, white, with a hairline on top and `env(safe-area-inset-bottom)` padding. It cancels the page's `--space-5` gutter so it spans the full width. From `lg` it is static and flat, right after the last field. SPEC 07 reuses it for the wizard |

Each primitive folder has a `types.ts` with its closed-set constants and unions (`ICON_NAME`, `ICON_SIZE`, `BUTTON_VARIANT`, `BUTTON_TYPE`, `INPUT_TYPE`, `INPUT_MODE`, `AUTO_COMPLETE`, `ALERT_TONE`, `ALERT_ROLE`); the `XProps` interface stays in the component file. `BUTTON_TYPE = { BUTTON: "button", SUBMIT: "submit", RESET: "reset" }` replaces any raw `type` literal (user decision). Every component consumes only CSS variables (colors and scale tokens) and the `_typography.scss` mixins. Focus is visible (`--color-lavender-500` outline). The spinner respects `prefers-reduced-motion`. Texts come from the caller or from `common.json`, never inline.

### Auth form contract (`src/shared/lib/auth/form-state.ts`)

Shared by the server factories and the client forms. Features cannot import `@/server`, and the server cannot import `@/features`. That is the same reason SPEC 04 put the HTTP contract in `src/shared/lib/api/`.

```ts
export const AUTH_FAILURE_KIND = {
  VALIDATION: "validation", INVALID_CREDENTIALS: "invalid_credentials",
  RATE_LIMITED: "rate_limited", UNEXPECTED: "unexpected",
} as const;

export type AuthFailure =
  | { kind: typeof AUTH_FAILURE_KIND.VALIDATION; fieldErrors: Record<string, ValidationCode[]> }
  | { kind: typeof AUTH_FAILURE_KIND.INVALID_CREDENTIALS; method: LoginMethod }
  | { kind: typeof AUTH_FAILURE_KIND.RATE_LIMITED; retryAfterMinutes: number }
  | { kind: typeof AUTH_FAILURE_KIND.UNEXPECTED; requestId: string };

export const AUTH_FORM_STATUS = { IDLE: "idle", ERROR: "error" } as const;
export type AuthFormState =
  | { status: typeof AUTH_FORM_STATUS.IDLE }
  | { status: typeof AUTH_FORM_STATUS.ERROR; failure: AuthFailure };
```

`LoginMethod` is derived from the existing `LOGIN_METHOD` in `src/domain/user/schemas.ts`. There is no success state, because a successful action redirects.

### Login rate limiter (`src/server/auth/login-rate-limiter.ts`)

```ts
interface LoginRateLimiter {
  check(key: string): { allowed: true } | { allowed: false; retryAfterMs: number };
  recordFailure(key: string): void;
  reset(key: string): void;
}
createLoginRateLimiter({ now, maxFailures: 5, windowMs: 15 * 60 * 1000 }): LoginRateLimiter
```

- The key is `` `${method}:${normalizedIdentifier}` ``, the output of `loginSchema`, so `55 1234 5678` and `5512345678` share one counter. Input that fails the schema never reaches the limiter.
- The window is fixed and starts at the first failure. Once it passes, the counter starts over.
- With 5 failures inside the window, `check` rejects every attempt, **including one with the right password** (user decision), until the window ends. Allowing a correct password through would let brute force still find it.
- A successful login calls `reset` (user decision).
- The default instance lives on `globalThis` under `Symbol.for("smw.loginRateLimiter")`, for the same reason as the database lock in SPEC 03.

### Auth action factories (`src/server/auth/auth-actions.ts`)

```ts
interface AuthActionDependencies {
  auth: AuthService; rateLimiter: LoginRateLimiter; logger: Logger; reporter: ErrorReporter;
}
interface AuthActions {
  login(input: unknown, requestId: string): Promise<Result<UserView, AuthFailure>>;
  register(input: unknown, requestId: string): Promise<Result<UserView, AuthFailure>>;
}
createAuthActions(deps): AuthActions
```

`login`, in order:

1. `loginSchema.safeParse(input)`. On failure → `validation` with `toFieldErrors`.
2. `rateLimiter.check(key)`. If rejected → `rate_limited` with `Math.ceil(retryAfterMs / 60000)`. `scrypt` does not run.
3. `auth.verifyCredentials`. On `INVALID_CREDENTIALS` → `recordFailure(key)` and `invalid_credentials` with the method.
4. On success → `reset(key)` and `ok(user)`.

`register`: `registerSchema.safeParse(input)` → `validation` on failure. Then `auth.register`, whose `VALIDATION_ERROR` details (`PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_REGISTERED`) also become `validation`.

In both, a thrown error is logged with `logger.error`, sent to `reporter.captureException` with `source: "server-action"` and the request id, and returned as `unexpected`. `ERROR_SOURCE` gains `SERVER_ACTION: "server-action"`. Neither function logs the input.

`src/server/container.ts` gains `getAuthActions()`, built once from `getServices().auth`, the global rate limiter, `logger` and `getErrorReporter()`.

### Server Actions (`src/features/auth/actions.ts`)

`"use server"` file. Each action reads `x-request-id` from `headers()`:

| Action | Signature | Behavior |
| --- | --- | --- |
| `loginAction` | `(prev: AuthFormState, input: LoginFormValues) => Promise<AuthFormState>` | `getAuthActions().login`. On failure, returns `{ status: "error", failure }`. On success, `setSessionCookie(user.id)`, then `redirect(ROUTES.HOME)` |
| `registerAction` | `(prev: AuthFormState, input: RegisterFormValues) => Promise<AuthFormState>` | Same flow with `register`. A new account goes straight to `/home` with a session (user decision) |
| `logoutAction` | `() => Promise<void>` | `clearSessionCookie()`, then `redirect(ROUTES.LOGIN)` |

`redirect()` is called outside any `try`/`catch`, because it works by throwing. Next's built-in origin check covers CSRF for Server Actions (SPEC 00 §11). The server always re-parses the input. Client validation is only UX.

### Forms (`src/features/auth/components/`)

One folder per component (user decision): `login-form/`, `register-form/`, `auth-failure-alert/`, `auth-brand-panel/` and `logout-button/`, each with its `.tsx`, `.test.tsx` and, when it has styles, `.module.scss`.

- `login-form.tsx`: React Hook Form with `zodResolver(loginSchema)` and the action through `useActionState`, dispatched inside `startTransition` from `handleSubmit` (user decision). The method defaults to `phone`. A `Segmented` "Celular / Email" above the fields (mobile review; it replaces the original "Iniciar sesión con email" link) switches the same form without changing route. It clears the identifier and any server error and keeps the password. Focus stays on the selector, as a radio group expects, instead of jumping to the new field. The phone field uses `prefix="+52"`, `inputMode="tel"`, `autoComplete="tel-national"` and `formatPhoneInput`. The email field uses `inputMode="email"` and `autoComplete="email"`.
- `register-form.tsx`: the same wiring with `registerSchema`. Fields: full name, mobile (same mask), email, password with the policy hint, and confirmation. `autoComplete` is `name`, `tel-national`, `email`, `new-password` and `new-password`.
- `auth-failure-alert.tsx`: renders an `AuthFailure` with an exhaustive `switch` on `kind` and `assertUnreachable`. `validation` renders nothing, because its codes go to the fields through RHF's `setError`. The other three render a `danger` `Alert` with `role="alert"` above the form. `unexpected` adds "Referencia: {requestId}".
- `logout-button.tsx`: a `<form action={logoutAction}>` with a `secondary` `Button` whose `loading` comes from `useFormStatus`.

Field errors are `ValidationCode`s translated with `useValidationMessage()` (`src/shared/i18n/`). The submit button shows `loading` while the action is pending. On mobile the submit button (and, on login, the "Regístrate" link) sits in a bottom action bar, `position: sticky` with `env(safe-area-inset-bottom)`; from `lg` the bar is static and follows the last field.

### Pages (`src/app/`)

| File | Rendering | Content |
| --- | --- | --- |
| `(public)/layout.tsx` | Static | Mobile-first column. At `md`, a centered white card of `--container-auth` (420 px) on the lavender background. From `lg`, a 50/50 grid: `AuthBrandPanel` on the left and the page on the right, with its content capped at `--container-form` (400 px) and aligned to the top |
| `AuthBrandPanel` (`src/features/auth/components/auth-brand-panel/`) | Static | Hidden below `lg`. Diagonal purple gradient, the orange ring, `BrandLogo` at `--size-logo-lg`, the headline "Envía dinero en segundos" (`--text-size-hero`), the lead, three perks with `phone`, `receipt` and `shield` icons in 36 px tiles, and "Spin by OXXO · Mini Wallet" at the bottom |
| `(public)/login/page.tsx` | Static shell + client form | Below `lg`: purple gradient header with `BrandLogo onDark`, "Hola de nuevo" and the subtitle. From `lg`: no header background or logo, and the title is ink at `--text-size-3xl`. Then `LoginForm`, whose action bar holds "¿No tienes cuenta? Regístrate" (purple, underlined) linking to `/register`; from `lg` it is separated from the form by a hairline. Metadata title "Iniciar sesión" |
| `(public)/register/page.tsx` | Static shell + client form | `AppBar` "Crea tu cuenta" back to `/login` (a "Regresar" link above a 32 px title from `lg`), then `RegisterForm`. Metadata title "Crea tu cuenta" |
| `src/app/layout.tsx` | — | Exports `viewport` with `interactiveWidget: "resizes-content"`, so the on-screen keyboard shrinks the layout and the action bar stays visible above it |
| `(private)/home/page.tsx` | Static shell + `<Suspense>` | Placeholder: a Server Component inside `<Suspense>` reads `getSession()`, calls `redirect(ROUTES.LOGIN)` without one (defense in depth), and shows "Hola, {name}" from `WalletService.getSummary` and the `LogoutButton` |

`src/app/page.tsx` and `src/app/page.module.scss` (the SPEC 01 landing page) are deleted, along with the `common.home` messages. The proxy answers `/`.

### Proxy (`src/proxy.ts`)

It keeps the SPEC 04 request id and adds the guard. It reads `smw_session` from `request.cookies` and verifies it with `verifySessionToken(token, getEnv().SESSION_SECRET, new Date())`. It applies `resolveRouteAccess`. A redirect is a `NextResponse.redirect` (307) that also carries `x-request-id`. The matcher does not change. An invalid or expired cookie counts as no session. The proxy does not delete it, because the cookie's `maxAge` (1800 s) already equals the token's expiry.

### Security headers (`src/shared/config/security-headers.ts`)

`securityHeaders(isProduction: boolean): { key: string; value: string }[]`, applied by `next.config.ts` `headers()` to `source: "/:path*"`:

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (production only) |

### Messages (`src/messages/es-MX/`)

New `auth.json` (namespace `auth`), aggregated in `index.ts`:

| Key | es-MX |
| --- | --- |
| `auth.login.metaTitle` | "Iniciar sesión" |
| `auth.login.title` | "Hola de nuevo" |
| `auth.login.subtitle` | "Entra a tu cuenta para enviar dinero." |
| `auth.login.phoneLabel` / `emailLabel` / `passwordLabel` | "Número celular" / "Email" / "Contraseña" |
| `auth.login.submit` / `submitting` | "Iniciar sesión" / "Iniciando sesión…" |
| `auth.login.methodLabel` / `methodPhone` / `methodEmail` | "Método de acceso" / "Celular" / "Email" |
| `auth.brand.headline` | "Envía dinero en segundos" |
| `auth.brand.lead` | "A un celular, una CLABE o una tarjeta, con tu comprobante al instante." |
| `auth.brand.perks.transfers` / `receipt` / `security` | "Envíos a celular, CLABE o tarjeta" / "Comprobante con folio y clave de rastreo" / "Tu sesión protegida en cada envío" |
| `auth.brand.legal` | "Spin by OXXO · Mini Wallet" |
| `auth.login.noAccount` / `registerLink` | "¿No tienes cuenta?" / "Regístrate" |
| `auth.register.metaTitle` / `title` | "Crea tu cuenta" |
| `auth.register.fullNameLabel` | "Nombre completo" |
| `auth.register.phoneLabel` / `emailLabel` | "Número celular" / "Email" |
| `auth.register.passwordLabel` / `passwordHint` | "Contraseña" / "Mínimo 8 caracteres, una mayúscula y un número." |
| `auth.register.passwordConfirmationLabel` | "Confirma tu contraseña" |
| `auth.register.submit` / `submitting` | "Crear cuenta" / "Creando cuenta…" |
| `auth.failure.invalidCredentials.phone` | "El celular o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo." |
| `auth.failure.invalidCredentials.email` | "El email o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo." |
| `auth.failure.rateLimited` | "Demasiados intentos. Espera {minutes, plural, one {# minuto} other {# minutos}} e inténtalo de nuevo." |
| `auth.failure.unexpected` | "Algo salió mal. Intenta más tarde." |
| `auth.failure.reference` | "Referencia: {requestId}" |
| `auth.logout.submit` / `submitting` | "Cerrar sesión" / "Cerrando sesión…" |

Added to `common.json`: `common.password.show` "Mostrar contraseña", `common.password.hide` "Ocultar contraseña", `common.appBar.back` "Regresar".

New `home.json` (namespace `home`): `home.placeholder.greeting` "Hola, {name}". SPEC 06 replaces it.

The invalid-credentials copy depends on the method (user decision). It still never says whether the account exists.

### E2E setup

- `playwright.config.ts` runs the server on port **3100** with `MOCK_DB_PATH=.data/e2e-db.json`, fixed and not read from the parent environment (user decision). `next dev --port 3100` locally, and `next build && next start --port 3100` with `CI=true`.
- `e2e/global-setup.ts` deletes `.data/e2e-db.json` before the run. The database re-reads the file on every operation and recreates it from the seed when it is missing, so the timing against `webServer` does not matter.
- `e2e/fixtures/auth.ts`: `loginAs(page, user)` through the real form, and `uniquePhone()` / `uniqueEmail()` for registration.

## Implementation plan

Each step leaves lint, typecheck and tests green and is committed on its own. Before writing a step, read the relevant guide in `node_modules/next/dist/docs/` (`02-guides/forms.md`, `02-guides/authentication.md`, `02-guides/authentication-with-cache-components.md`, `03-api-reference/03-file-conventions/proxy.md`, and `headers` in `next-config-js`).

1. **Branch and docs.** Pull `develop` (it must include PR #4) and create `feature/05-auth`. In SPEC 00 §11, record the rate-limit semantics (fixed 15-minute window from the first failure, blocks even a correct password, resets on success). Also record that `/api/**` is never redirected. In §14, add `--color-info` and `--color-info-bg`. In §15, record the E2E port 3100 and `.data/e2e-db.json`. Link this spec from `roadmap.md` and mark 05 as in progress.
   - Why: other sessions read these files, not this chat.

2. **Dependencies and tokens.** `npm install zod react-hook-form @hookform/resolvers`, with `zod` pinned to the major already resolved (4.x) and `@hookform/resolvers` on `^5.9.2` (6.0.0 fails `npm install` with an `ERESOLVE` between its own optional peers; user decision). Add the two info tokens and the scale tokens to `@theme static` in `globals.css`.
   - Why: the domain imports `zod` without declaring it. A change in ESLint's dependencies would break the build.

3. **Routes and phone mask.** Create `src/shared/lib/routes.ts` and `src/shared/lib/format/phone.ts` with tests. Cover every row of the access table, including `/home/x`, `/transfers/new/amount`, `/api/v1/wallet/summary` and `/favicon.ico`. For the mask, cover empty input, letters, 3 digits, 10 digits and 12 digits.
   - Why: pure functions the proxy and the forms both depend on, proven before anything uses them.

4. **Icon and Button.** Create `src/shared/ui/icon/` and `src/shared/ui/button/` with tests: an icon without `label` is `aria-hidden` and one with `label` has `role="img"`; each variant gets its BEM class; `loading` disables the button, sets `aria-busy`, shows `loadingLabel` and ignores clicks; `type` defaults to `"button"`.
   - Why: the base pieces Field, Alert and AppBar build on.

5. **Field and PasswordInput.** Create `src/shared/ui/field/` and `src/shared/ui/password-input/` with tests: the label is associated with the input, the prefix renders, `error` sets `aria-invalid` and `aria-describedby` to the error's id, the hint is described when there is no error, and a `ref` reaches the `<input>`. The password toggle switches `type`, its label and `aria-pressed`.
   - Why: every form in SPEC 05–07 is built from these two.

6. **Alert and AppBar.** Create `src/shared/ui/alert/` and `src/shared/ui/app-bar/` with tests: each tone renders its class and icon, `role` is passed through, the tone → icon `default` branch is reached with an invalid tone cast through `as unknown as AlertTone`, and the AppBar back link has `href` and the "Regresar" label.
   - Why: the server error on login and the register app bar.

7. **Form contract and rate limiter.** Create `src/shared/lib/auth/form-state.ts` and `src/server/auth/login-rate-limiter.ts` with tests and a fake `now`: 5 failures are allowed and the 6th is rejected with the remaining time, `reset` clears the counter, the window expires, and two keys are independent. Add `SERVER_ACTION` to `ERROR_SOURCE`.
   - Why: the rule that protects credentials, proven with time under control.

8. **Auth action factories.** Create `src/server/auth/auth-actions.ts` and `getAuthActions()` in `container.ts`, with tests against a temporary database. Cover: login by phone with `55 1234 5678`, login by email in upper case, `validation` for an empty password, `invalid_credentials` with the method, `rate_limited` on the 6th attempt even with the right password, and `scrypt` not running while blocked (spy on `verifyCredentials`). Also cover: registration success, `PHONE_ALREADY_REGISTERED` as `validation`, `PASSWORD_MISMATCH` on `passwordConfirmation`, and a throwing service becoming `unexpected` and reported once with `source: "server-action"`.
   - Why: every login and registration rule is tested once, in the node project, with no Next mocks.

9. **Server Actions and messages.** Create `src/features/auth/actions.ts`, plus `auth.json`, `home.json` and the new `common.json` keys, aggregated in `index.ts`. Add a test that mocks `next/headers` and `next/navigation`: success sets the cookie and redirects to `/home`, failure returns the state and does not redirect, and logout clears the cookie and redirects to `/login`.
   - Why: thin bindings between the factories, the cookie and navigation.

10. **Home placeholder and logout.** Create `src/features/auth/components/logout-button/logout-button.tsx` with a test, and `src/app/(private)/home/page.tsx`. Manual check: with a cookie set from step 9, `/home` shows the greeting, and logout returns to `/login` (404 until step 11).
    - Why: login needs a real destination, so the full flow can be tested end to end.

11. **Login page.** Create `src/app/(public)/layout.tsx`, `(public)/login/page.tsx`, `login-form.tsx` and `auth-failure-alert.tsx`, with tests that replace `../actions` with `vi.mock`. Cover: the phone default with `+52` and the mask, the switch to email that moves focus and clears the identifier, inline field errors on submit with no action call, the three alert kinds with `role="alert"`, the alert's `default` branch with an invalid kind, and the loading state on submit.
    - Why: PDF screen 1, login part, following the design.
    - Note: implemented before the 2026-10-22 design approvals. Step 12 replaces the switch link and the focus move with the segmented selector.

12. **Approved design alignment.** Update `specs/design/mini-wallet-design.html` (tokens in its `:root`, the approved Pantalla 1 mocks, the segmented selector in the desktop login mock, a new "Registro · pantalla dividida" mock and the "Implementación" snippet), `challenge.md` §8, SPEC 00 §14 and this spec. Then, in code:
    - `globals.css`: the review and desktop tokens.
    - `Button`: `ink-900` primary label, 50 px minimum height on mobile, 48 px and a 200 px minimum width (unless `block`) from `lg`.
    - `Field`: 16 px input text. `PasswordInput`: 44 px toggle hit area. `AppBar`: 44 px back hit area, and the "Regresar" + 32 px title layout from `lg`. `Alert`: `success-strong` text.
    - `Icon`: `phone`, `receipt` and `shield`.
    - New `Segmented` and `ActionBar` primitives with tests. `BrandLogo` gains `size?: BrandLogoSize` (`md` / `lg`). `Segmented`: options render as radios inside a labeled `radiogroup`, the selected value is checked, and clicking or pressing an arrow key calls `onChange`. The 44 px height comes from `--size-touch` in its SCSS; jsdom has no layout, so the E2E checks it.
    - `LoginForm`: the segmented selector replaces the switch link; the submit button and the "Regístrate" link move into the action bar. Tests: switching to email clears the identifier and the server error and keeps the password.
    - `(public)/layout.tsx` with the `md` card and the `lg` split, the new `AuthBrandPanel` with a test, the login page's `lg` header, purple underlined links, and `viewport` with `interactiveWidget: "resizes-content"` in `src/app/layout.tsx`.
    - `auth.json`: `methodLabel` / `methodPhone` / `methodEmail` and the `brand` keys replace `switchToEmail` / `switchToPhone`.
    - Why: the design changed after steps 4–6 and 11 were built. Aligning now means registration (step 13) and SPEC 06–08 start from the approved primitives.

13. **Register page.** Create `(public)/register/page.tsx` and `register-form/register-form.tsx` with tests: the password hint, `PASSWORD_MISMATCH` inline, a server `PHONE_ALREADY_REGISTERED` shown on the phone field, and the loading state. It is built directly on the step 12 layout, action bar and AppBar.
    - Why: PDF screen 1, registration part.

14. **Proxy guard, `/` and headers.** Extend `src/proxy.ts` and its tests. Move `src/proxy.test.ts` to the Vitest `node` project, because `token.ts` imports `server-only`. Cover: `/home` without a cookie → 307 to `/login` with `x-request-id`; `/login` with a valid cookie → `/home`; a tampered or expired cookie counts as none; `/` in both cases; `/api/v1/wallet/summary` without a session passes through. Create `security-headers.ts` with tests and wire it in `next.config.ts`. Delete `src/app/page.tsx`, `page.module.scss` and `common.home`, and update `e2e/smoke.spec.ts` so `/` lands on `/login`.
    - Why: the first barrier in front of private pages (SPEC 00 §11). Handlers and the page itself keep re-checking the session.

15. **E2E.** Update `playwright.config.ts` (port 3100, `.data/e2e-db.json`, `globalSetup`) and add `e2e/global-setup.ts`, `e2e/fixtures/auth.ts` and `e2e/auth.spec.ts`. The specs cover: login by phone, login by email after the switch, invalid credentials with an unregistered phone, inline field errors, registration with a unique phone and email landing on `/home`, the guard redirects, and logout. They also cover the API smoke test: after login, `page.request.get("/api/v1/wallet/summary")` answers `200`, has `x-request-id` and contains `"Mariana López"`. Finally, the security headers on `/login`, the 44 px height of the segmented options on mobile, and the brand panel being visible on the `desktop` project and hidden on `mobile`.
    - Why: proves the session works across proxy, pages, Server Actions and Route Handlers in a real browser, on mobile and desktop.

16. **Docs.** Add an "Authentication" section to `CLAUDE.md`: the action factories with injected dependencies and thin `actions.ts`, the `AuthFormState` contract in `src/shared/lib/auth/`, RHF + `useActionState`, the rate-limit rule, `resolveRouteAccess` in the proxy, `/api/**` never redirected, the UI primitives and their props (including `Segmented`), the public layout (md card, lg split with `AuthBrandPanel`), the bottom action bar and `interactiveWidget`, and the E2E port and database. Mark SPEC 05 as `Implemented` in `roadmap.md` once the criteria pass.
    - Why: SPEC 06–08 build on these primitives and conventions from other sessions.

## Acceptance criteria

- [x] `package.json` lists `zod`, `react-hook-form` and `@hookform/resolvers` under `dependencies`.
- [x] SPEC 00 §11 describes the rate-limit semantics, §14 lists `--color-info` and `--color-info-bg`, and §15 lists port 3100 and `.data/e2e-db.json`.
- [x] `resolveRouteAccess("/transfers/new/amount", false)` redirects to `/login`, and `resolveRouteAccess("/api/v1/wallet/summary", false)` answers `next`.
- [x] `formatPhoneInput("551234567899")` returns `"55 1234 5678"`.
- [x] A `Button` with `loading` is disabled, has `aria-busy="true"` and does not call `onClick`.
- [x] A `Field` with `error` has `aria-invalid="true"` and an `aria-describedby` that points to the element holding the error text.
- [x] The `PasswordInput` toggle switches the input between `password` and `text` and updates its accessible name.
- [x] `Alert` renders the four tones, and `alert`, `button`, `field`, `password-input`, `icon`, `app-bar`, `segmented` and `action-bar` live in `src/shared/ui/` with `.tsx`, `.module.scss`, `.test.tsx` and, where they declare closed-set constants, `types.ts`, with no hex value and no loose measured value in any SCSS file.
- [x] Five failed logins for one phone make the 6th attempt answer `rate_limited`, even with the right password, and `verifyCredentials` is not called for it.
- [x] A successful login resets the counter, and after 15 minutes (fake clock) the same phone may try again.
- [x] `login` with `{ method: "phone", phone: "55 1234 5678", password: "Spin2026" }` returns Mariana's `UserView`.
- [x] `register` with an existing phone returns `validation` with `phone: ["PHONE_ALREADY_REGISTERED"]`.
- [x] A throwing `AuthService` makes `login` return `unexpected` with the request id and calls `reporter.captureException` once with `source: "server-action"`.
- [x] No logger call in `src/server/auth/` receives the password or the identifier.
- [x] `/login` shows the phone field with `+52` by default, and choosing "Email" in the segmented selector switches it to an email field on the same URL.
- [x] Submitting the login form empty shows "Escribe tu número celular." and "Escribe tu contraseña." inline and does not call the action.
- [x] A wrong password shows the method's invalid-credentials message in an element with `role="alert"`.
- [x] Registering with a new phone and email lands on `/home` with "Hola, {name}" and a `smw_session` cookie.
- [x] Without a session, `/`, `/home` and `/transfers/new/amount` redirect to `/login`. With one, `/` and `/login` redirect to `/home`.
- [x] Without a session, `GET /api/v1/wallet/summary` still answers `401` JSON, not a redirect.
- [x] "Cerrar sesión" clears `smw_session` and lands on `/login`, and going back to `/home` redirects to `/login` again.
- [x] After a login in Playwright, `GET /api/v1/wallet/summary` answers `200` with an `x-request-id` header and Mariana's name.
- [x] Every page response has `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` and `Permissions-Policy`. `Strict-Transport-Security` appears only in production.
- [x] `npm run test:e2e` passes on the `mobile` and `desktop` projects against `.data/e2e-db.json`, and leaves `.data/db.json` untouched.
- [x] `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100 % on `src/domain/**`, 80 % on `src/server/**`, `src/shared/lib/**` and `src/shared/observability/**`) and `npm run build` finish with no errors.
- [x] No component or page contains user-facing text outside `src/messages/es-MX/`.
- [x] The primary button label uses `--color-on-brand-orange`, inputs use `--text-size-input` (16 px), and the segmented options, the AppBar back link and the password toggle have a hit area of at least 44 × 44 px.
- [x] Links on the auth screens are purple and underlined; no text is orange.
- [x] On a mobile viewport the login and register CTAs sit in the bottom action bar, and `src/app/layout.tsx` exports `viewport.interactiveWidget = "resizes-content"`.
- [x] From 1024 px, `/login` and `/register` show the brand panel on the left and a form of at most 400 px aligned to the top on the right; below 1024 px the panel is not rendered visibly.
- [x] `specs/design/mini-wallet-design.html`, `challenge.md` §8 and SPEC 00 §14 describe the approved mobile review and desktop proposal, including the "Registro · pantalla dividida" mock.
- [x] There are no comments in any file created or modified in this milestone.

## Decisions

- **Yes:** React Hook Form with `zodResolver` over the domain schemas, submitting to the Server Action through `useActionState` (user decision). One schema validates on client and server, as SPEC 00 §3 says, and errors appear inline before any request.
- **No:** a native `<form action>` with `useActionState` only. It works without JavaScript, but it gives no immediate client validation and contradicts SPEC 00 §3.
- **Yes:** action logic in factories under `src/server/auth/` with injected dependencies, and a thin `actions.ts` (user decision). It is the SPEC 04 handler pattern. Tests control time and services without mocking Next modules.
- **Yes:** the `AuthFormState` / `AuthFailure` contract in `src/shared/lib/auth/`. The client and the server share it without breaking the import boundaries, the same as SPEC 04's HTTP contract.
- **Yes:** a minimal `/home` placeholder with a greeting and logout (user decision). Login, registration, logout and the guard can be tested end to end now. SPEC 06 replaces it.
- **Yes:** after login and registration, always go to `/home` (user decision). There is no open-redirect surface, and the wizard draft survives in `sessionStorage` (SPEC 07).
- **No:** a `?next=` parameter. It needs internal-path validation and more tests for a small UX gain.
- **Yes:** registration logs the user in and lands on `/home` (user decision). One step less, as in wallet apps.
- **Yes:** the rate limit blocks every attempt after 5 failures, even a correct one, and a successful login resets it (user decision). Letting a correct password through would make the limit useless against brute force.
- **Yes:** the limiter runs after the schema and before `scrypt`. Malformed input does not consume attempts, and a blocked identifier costs no hashing.
- **Yes:** the limiter key is the normalized identifier, prefixed with the method. Formatting variants of one phone cannot bypass it.
- **No:** a per-IP limit. SPEC 00 §11 defines it per identifier, and IPs behind carrier NAT are shared by many users on mobile networks.
- **Yes:** `Icon` and `AppBar` join the four roadmap primitives (user decision). Alert, PasswordInput and Registration already need them, and SPEC 07 reuses AppBar.
- **No:** an icon library. The design ships its own SVG symbols, and one more dependency adds nothing.
- **Yes:** `--color-info` and `--color-info-bg` with the design's values (user decision). Alert ships the four tones the design defines, and SPEC 08 uses `info` while processing.
- **Yes:** the phone field masks to `55 1234 5678` as the user types (user decision). It follows the design, and `validatePhone` already strips spaces.
- **Yes:** invalid-credentials copy that names the method in use (user decision). It follows the design and still does not reveal whether the account exists.
- **Yes:** the proxy never redirects `/api/**`. Route Handlers answer `401` JSON, and a client fetch must never follow a redirect to an HTML page.
- **Yes:** the proxy treats an invalid cookie as no session and does not delete it. The cookie's `maxAge` already equals the token's lifetime.
- **Yes:** the `/home` placeholder re-checks the session itself. The proxy is not the only barrier (SPEC 00 §11).
- **Yes:** delete the SPEC 01 landing page. `/` is a redirect in SPEC 00 §4, so the page would be unreachable.
- **Yes:** `zod` becomes a direct dependency. The domain already imports it, and relying on a transitive copy from ESLint is a hidden break.
- **Yes:** E2E on port 3100 with `.data/e2e-db.json`, deleted before each run (user decision). A running `npm run dev` on 3000 is never reused, and tests do not touch the demo database.
- **Yes:** the rate limit is tested only in unit tests (user decision). It is time-based logic that a fake clock proves better than a browser.
- **Yes:** the invalid-credentials E2E uses an unregistered phone. Failures on Mariana's identifier could block her login in parallel tests.
- **Yes:** security headers built by a pure function in `src/shared/config/`. They can be tested without starting Next, and HSTS only applies in production.
- **No:** a Content Security Policy in this milestone. SPEC 00 does not require one, and a nonce-based CSP interacts with Cache Components prerendering.
- **Yes:** adopt the mobile review and desktop proposal approved on 2026-10-22 for everything auth touches, inside this milestone (user decision). Shipping auth with the old CTA contrast, 15 px inputs and a floating mobile card on desktop, and fixing it in SPEC 06, would rework the same files twice.
- **Yes:** the CTA keeps `#FF6600` with an `ink-900` label (option A). White on orange is 2.9:1 and fails AA; a darker orange drifts from the brand.
- **Yes:** the `Segmented` primitive is built here, on native radio inputs. The login needs it now, SPEC 07 reuses it for Celular / CLABE / Tarjeta, and native radios give arrow-key navigation for free.
- **No:** moving focus to the identifier field when the method changes. With a radio group, arrow keys change the selection; stealing focus on each change would break keyboard use.
- **Yes:** registration on desktop uses the same split screen as login (user decision). The design had no desktop register mock; one was added to the design document for it.
- **Yes:** the brand panel lives in `(public)/layout.tsx` through `AuthBrandPanel`, so login and registration share it and it is not remounted when moving between them.
- **Yes:** spacing tokens snap to the 4 px grid, while dimensions and type sizes keep the design's exact values (user decision). Differences of 1–2 px in padding are invisible; in sizes they are not.

## Risks

| Risk | Mitigation |
| --- | --- |
| `proxy.ts` imports `token.ts`, which starts with `import "server-only"` | Next's server compilers alias `server-only` to its empty module, and the proxy runs on Node. `npm run build` is an acceptance criterion. The proxy test moves to the Vitest `node` project, where the alias already exists |
| RHF's `zodResolver` returns the transformed output, while the action expects raw input | The client sends the raw form values, and the action re-parses them with the same schema. The step 8 and 11 tests use raw strings such as `55 1234 5678` |
| The in-memory rate limit resets on restart and is per instance | SPEC 00 §11 accepts it. It is documented as a limitation in the SPEC 09 README |
| Parallel E2E runs on mobile and desktop exhaust the limit for a shared user | Only successful logins use the seed users, and the failing test uses an unregistered phone |
| Reading cookies on `/home` breaks prerendering with Cache Components | The session read sits inside `<Suspense>`, and `npm run build` catches a violation |
| A redirect thrown by `redirect()` is caught as an error | `redirect()` is only called in `actions.ts`, outside any `try`/`catch`. The factories return `Result` and never redirect |
| The CI environment sets `MOCK_DB_PATH=.data/db.json` at job level | `playwright.config.ts` sets the E2E path explicitly instead of reading `process.env.MOCK_DB_PATH` |

## What is **not** in this spec

- The private shell, the real Home, `error.tsx` and `global-error.tsx` (SPEC 06).
- Skeletons and the transfer wizard (SPEC 06–07).
- The rest of the mobile review and the desktop proposal: the "Mi cuenta" sheet, the icon rail and `xl` sidebar, the 1040 px container, and the wizard and result layouts (SPEC 06–08).
- `?next=` return paths.
- An E2E test for the rate limit.
- Password recovery, OTP, MFA and "remember me".
- A Content Security Policy and a distributed rate limit.

Each of them lands in the milestone listed in `specs/roadmap.md`, or stays out of the project as SPEC 00 §2 says.
