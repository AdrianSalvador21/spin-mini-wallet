import { expect, test } from "@playwright/test";
import { ROUTES } from "../src/shared/lib/routes";
import {
  DIEGO,
  greetingLocator,
  LOGIN_METHOD,
  loginAs,
  logout,
  MARIANA,
  MOBILE_PROJECT,
  PASSWORD,
  SESSION_COOKIE,
  uniqueEmail,
  uniquePhone,
} from "./fixtures/auth";

const MIN_TOUCH_TARGET_PX = 44;
const SUMMARY_PATH = "/api/v1/wallet/summary";
const REQUEST_ID_HEADER = "x-request-id";
const UNAUTHORIZED = 401;
const OK = 200;
const HSTS_VALUE = "max-age=63072000; includeSubDomains";

function urlOf(path: string): RegExp {
  return new RegExp(`${path}$`);
}

test.describe("login", () => {
  test("logs in by phone and lands on home", async ({ page }, testInfo) => {
    await loginAs(page, MARIANA);

    await expect(greetingLocator(page, MARIANA, { mobile: testInfo.project.name === MOBILE_PROJECT })).toBeVisible();
  });

  test("logs in by email after switching the method", async ({ page }, testInfo) => {
    await loginAs(page, DIEGO, LOGIN_METHOD.EMAIL);

    await expect(greetingLocator(page, DIEGO, { mobile: testInfo.project.name === MOBILE_PROJECT })).toBeVisible();
  });

  test("shows the phone invalid-credentials message for an unregistered phone", async ({ page }) => {
    await page.goto(ROUTES.LOGIN);
    await page.getByLabel("Número celular", { exact: true }).fill(uniquePhone());
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "El celular o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo." }),
    ).toBeVisible();
    await expect(page).toHaveURL(urlOf(ROUTES.LOGIN));
  });

  test("shows inline errors on an empty submit", async ({ page }) => {
    await page.goto(ROUTES.LOGIN);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText("Escribe tu número celular.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
    await expect(page).toHaveURL(urlOf(ROUTES.LOGIN));
  });
});

test.describe("registration", () => {
  test("registers a new user and lands on home with a session", async ({ page, context }, testInfo) => {
    const fullName = "Usuaria Prueba";

    await page.goto(ROUTES.REGISTER);
    await page.getByLabel("Nombre completo").fill(fullName);
    await page.getByLabel("Número celular", { exact: true }).fill(uniquePhone());
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail());
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirma tu contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(urlOf(ROUTES.HOME));
    await expect(
      greetingLocator(page, { fullName }, { mobile: testInfo.project.name === MOBILE_PROJECT }),
    ).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(true);
  });
});

test.describe("route guard", () => {
  for (const path of [ROUTES.ROOT, ROUTES.HOME, "/transfers/new/amount"]) {
    test(`redirects ${path} to /login without a session`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(urlOf(ROUTES.LOGIN));
    });
  }

  test("redirects / and /login to /home with a session", async ({ page }) => {
    await loginAs(page, MARIANA);

    await page.goto(ROUTES.ROOT);
    await expect(page).toHaveURL(urlOf(ROUTES.HOME));

    await page.goto(ROUTES.LOGIN);
    await expect(page).toHaveURL(urlOf(ROUTES.HOME));
  });

  test("answers the API with 401 JSON instead of a redirect without a session", async ({ request }) => {
    const response = await request.get(SUMMARY_PATH, { maxRedirects: 0 });

    expect(response.status()).toBe(UNAUTHORIZED);
    expect(response.headers()["content-type"]).toContain("application/json");
  });
});

test.describe("logout", () => {
  test("clears the session and keeps /home behind the guard", async ({ page, context }, testInfo) => {
    await loginAs(page, MARIANA);

    await logout(page, { mobile: testInfo.project.name === MOBILE_PROJECT });

    await expect(page).toHaveURL(urlOf(ROUTES.LOGIN));
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false);

    await page.goto(ROUTES.HOME);
    await expect(page).toHaveURL(urlOf(ROUTES.LOGIN));
  });
});

test.describe("authenticated API", () => {
  test("serves the wallet summary to a logged-in browser", async ({ page }) => {
    await loginAs(page, MARIANA);

    const response = await page.request.get(SUMMARY_PATH);

    expect(response.status()).toBe(OK);
    expect(response.headers()[REQUEST_ID_HEADER]).toBeTruthy();
    expect(await response.text()).toContain(MARIANA.fullName);
  });
});

test.describe("page chrome", () => {
  test("sends the security headers on /login", async ({ request }) => {
    const response = await request.get(ROUTES.LOGIN);
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    expect(headers["strict-transport-security"]).toBe(process.env.CI ? HSTS_VALUE : undefined);
  });

  test("shows the brand panel on desktop only and keeps touch targets at 44 px", async ({ page }, testInfo) => {
    await page.goto(ROUTES.LOGIN);

    const isMobile = testInfo.project.name === MOBILE_PROJECT;
    const panel = page.getByText("Envía dinero en segundos");

    if (isMobile) {
      await expect(panel).toBeHidden();
    } else {
      await expect(panel).toBeVisible();
    }

    for (const name of ["Celular", "Email"]) {
      const option = page.getByRole("radio", { name }).locator("..");
      const box = await option.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    }

    const toggle = await page.getByRole("button", { name: "Mostrar contraseña" }).boundingBox();
    expect(toggle?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });
});
