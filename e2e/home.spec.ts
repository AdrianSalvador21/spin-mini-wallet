import { expect, test } from "@playwright/test";
import { READ_SCENARIO } from "../src/shared/lib/api/contract";
import { DESKTOP_PROJECT, DIEGO, greetingLocator, loginAs, logout, MARIANA, MOBILE_PROJECT } from "./fixtures/auth";
import { clearReadScenario, setReadScenario } from "./fixtures/scenario";

const MARIANA_BALANCE = "$12,450.80";
const DIEGO_BALANCE = "$500.00";
const PAGE_SIZE = 10;
const MARIANA_MOVEMENT_COUNT = 25;

test.describe("home", () => {
  test("shows Mariana's name and balance", async ({ page }, testInfo) => {
    await loginAs(page, MARIANA);

    await expect(greetingLocator(page, MARIANA, { mobile: testInfo.project.name === MOBILE_PROJECT })).toBeVisible();
    await expect(page.getByText(MARIANA_BALANCE)).toBeVisible();
  });

  test("paginates movements 10 at a time until all 25 are loaded", async ({ page }) => {
    await loginAs(page, MARIANA);

    const movementsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Movimientos recientes", level: 2 }),
    });
    const rows = movementsSection.getByRole("listitem");

    await expect(rows).toHaveCount(PAGE_SIZE);

    await page.getByRole("button", { name: "Ver más movimientos" }).click();
    await expect(rows).toHaveCount(PAGE_SIZE * 2);

    await page.getByRole("button", { name: "Ver más movimientos" }).click();
    await expect(rows).toHaveCount(MARIANA_MOVEMENT_COUNT);

    await expect(page.getByRole("button", { name: "Ver más movimientos" })).toBeHidden();
  });

  test("filters to Recibidos, updates the URL without a full load and survives a reload", async ({ page }) => {
    await loginAs(page, MARIANA);

    await page.getByRole("radio", { name: "Recibidos" }).check();
    await expect(page).toHaveURL(/direction=credit/);

    const amount = page.getByText(/^\+\$/).first();
    await expect(amount).toBeVisible();
    const amounts = await page.getByText(/^[+−]\$/).allTextContents();
    expect(amounts.every((text) => text.startsWith("+"))).toBe(true);

    await page.reload();
    await expect(page.getByRole("radio", { name: "Recibidos" })).toBeChecked();
    await expect(page).toHaveURL(/direction=credit/);
  });

  test("shows Diego's empty state", async ({ page }) => {
    await loginAs(page, DIEGO);

    await expect(page.getByText(DIEGO_BALANCE)).toBeVisible();
    await expect(page.getByText("Aún no tienes movimientos")).toBeVisible();
  });

  test("movements_error keeps the balance and lets Reintentar recover the list", async ({ page, context }) => {
    await loginAs(page, MARIANA);
    await setReadScenario(context, READ_SCENARIO.MOVEMENTS_ERROR);
    await page.reload();

    await expect(page.getByText(MARIANA_BALANCE)).toBeVisible();
    await expect(page.getByText("No pudimos cargar tus movimientos")).toBeVisible();
    await expect(page.getByText(/Referencia: /)).toBeVisible();

    await clearReadScenario(context);
    await page.getByRole("button", { name: "Reintentar" }).click();

    await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  });

  test("the error scenario fails both blocks without falling into error.tsx", async ({ page, context }) => {
    await loginAs(page, MARIANA);
    await setReadScenario(context, READ_SCENARIO.ERROR);
    await page.reload();

    await expect(page.getByText("No pudimos cargar tu saldo")).toBeVisible();
    await expect(page.getByText("No pudimos cargar tus movimientos")).toBeVisible();
    await expect(page.getByText("Algo salió mal")).toBeHidden();
  });

  test("shows the Home skeleton before the balance when the read is slow", async ({ page, context }) => {
    await loginAs(page, MARIANA);
    await setReadScenario(context, READ_SCENARIO.SLOW);

    await page.reload({ waitUntil: "commit" });
    await expect(page.getByText(MARIANA_BALANCE)).toBeHidden();
    await expect(page.getByText(MARIANA_BALANCE)).toBeVisible({ timeout: 6000 });
  });

  test("hiding the balance survives a reload with no flash of the amount", async ({ page }) => {
    await loginAs(page, MARIANA);

    await page.getByRole("button", { name: "Ocultar saldo" }).click();
    await expect(page.getByRole("button", { name: "Mostrar saldo" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(MARIANA_BALANCE)).toBeHidden();

    await page.reload();
    await expect(page.getByText(MARIANA_BALANCE)).toBeHidden();
    await expect(page.getByRole("button", { name: "Mostrar saldo" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("home mobile shell", () => {
  test("opens Mi cuenta from the avatar, Esc closes it, and Cerrar sesión lands on /login", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE_PROJECT, "mobile-only sheet navigation");

    await loginAs(page, MARIANA);

    await page.getByRole("button", { name: "Abrir mi cuenta" }).click();
    const sheet = page.getByRole("dialog", { name: "Mi cuenta" });
    await expect(sheet).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await logout(page, { mobile: true });
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("home desktop shell", () => {
  test("marks Inicio as the current page in the sidebar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP_PROJECT, "desktop-only sidebar");

    await loginAs(page, MARIANA);

    await expect(page.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  });

  test("shows the icon rail with visually hidden labels at 1100px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP_PROJECT, "desktop-only sidebar");

    await loginAs(page, MARIANA);
    await page.setViewportSize({ width: 1100, height: 800 });

    const homeLink = page.getByRole("link", { name: "Inicio" });
    await expect(homeLink).toBeVisible();

    const label = homeLink.locator("span", { hasText: "Inicio" });
    await expect(label).toHaveCSS("opacity", "0");
  });
});
