import { expect, test } from "@playwright/test";
import { READ_SCENARIO } from "../src/shared/lib/api/contract";
import { ROUTES } from "../src/shared/lib/routes";
import { SESSION_STORAGE_KEY } from "../src/shared/lib/session-storage/client-session";
import { DESKTOP_PROJECT, DIEGO, loginAs, logout, MARIANA, MOBILE_PROJECT } from "./fixtures/auth";
import { clearReadScenario, setReadScenario } from "./fixtures/scenario";
import { amountInput, continueButton, openWizardFromHome, pickContact, startTransfer } from "./fixtures/wizard";

const NEW_CLABE = "002123456789012343";
const NEW_CLABE_NAME = "Beatriz Soto";
const FULL_ACCOUNT_DIGITS = /\d{10,}/;

test.describe("transfer wizard", () => {
  test("Enviar dinero on Home opens the amount step", async ({ page }, testInfo) => {
    await loginAs(page, MARIANA);
    await openWizardFromHome(page);

    if (testInfo.project.name === MOBILE_PROJECT) {
      await expect(page.getByText("1 de 3")).toBeVisible();
    } else {
      await expect(page.getByRole("list", { name: "Progreso del envío" }).getByRole("listitem").first()).toHaveAttribute(
        "aria-current",
        "step",
      );
    }
  });

  test("0 and an amount over the balance show their errors", async ({ page }) => {
    await loginAs(page, MARIANA);
    await openWizardFromHome(page);

    await amountInput(page).fill("0");
    await continueButton(page).click();
    await expect(page.getByText("El monto debe ser mayor a cero.")).toBeVisible();

    await amountInput(page).fill("12450.81");
    await continueButton(page).click();
    await expect(page.getByText(/El monto supera tu saldo disponible/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_AMOUNT}$`));
  });

  test("Todo fills the whole balance", async ({ page }) => {
    await loginAs(page, MARIANA);
    await openWizardFromHome(page);

    await page.getByRole("button", { name: "Todo" }).click();

    await expect(amountInput(page)).toHaveValue("12,450.80");
  });

  test("Carlos reaches the review with Saldo después, and a reload keeps everything", async ({ page }) => {
    await loginAs(page, MARIANA);
    await startTransfer(page, "350");
    await pickContact(page, "Carlos Ruiz");

    const summary = page.locator("dl");
    await expect(summary).toContainText("Carlos Ruiz");
    await expect(summary).toContainText("Celular •••• 6789");
    await expect(summary).toContainText("Comisión$0.00");
    await expect(summary).toContainText("Saldo después$12,100.80");
    await expect(page.getByRole("button", { name: "Confirmar envío" })).toBeEnabled();

    const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_STORAGE_KEY.TRANSFER_DRAFT);
    expect(stored).not.toMatch(FULL_ACCOUNT_DIGITS);

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_REVIEW}$`));
    await expect(summary).toContainText("Carlos Ruiz");
    await expect(summary).toContainText("Saldo después$12,100.80");
  });

  test("a new CLABE contact detects its bank and appears in the favorites", async ({ page }) => {
    await loginAs(page, MARIANA);
    await startTransfer(page, "100");

    await page.getByRole("button", { name: "Agregar nuevo destinatario" }).click();
    await expect(page).toHaveURL(/\?mode=new$/);

    await page.getByRole("radio", { name: "CLABE" }).check();
    await page.getByLabel("Nombre del destinatario").fill(NEW_CLABE_NAME);
    await page.getByLabel("CLABE interbancaria").fill(NEW_CLABE);
    await expect(page.getByText("Banco detectado: Banamex")).toBeVisible();

    await continueButton(page).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_REVIEW}$`));
    await expect(page.locator("dl")).toContainText(NEW_CLABE_NAME);

    const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_STORAGE_KEY.TRANSFER_DRAFT);
    expect(stored).not.toMatch(FULL_ACCOUNT_DIGITS);

    await page.goto(ROUTES.TRANSFER_RECIPIENT);
    await expect(page.getByRole("radio", { name: new RegExp(`^${NEW_CLABE_NAME}`) })).toBeVisible();
  });

  test("the browser back button closes the new-recipient form", async ({ page }) => {
    await loginAs(page, MARIANA);
    await startTransfer(page, "100");

    await page.getByRole("button", { name: "Agregar nuevo destinatario" }).click();
    await expect(page.getByLabel("Nombre del destinatario")).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_RECIPIENT}$`));
    await expect(page.getByRole("radiogroup", { name: "Contactos favoritos" })).toBeVisible();
  });

  test("saving Mariana's own phone shows the self-transfer error", async ({ page }) => {
    await loginAs(page, MARIANA);
    await startTransfer(page, "100");
    await page.getByRole("button", { name: "Agregar nuevo destinatario" }).click();

    await page.getByLabel("Nombre del destinatario").fill("Mariana López");
    await page.getByLabel("Número celular", { exact: true }).fill(MARIANA.phone);
    await continueButton(page).click();

    await expect(page.getByText("No puedes enviarte dinero a ti mismo.")).toBeVisible();
  });

  test("Diego sees the empty contacts state", async ({ page }) => {
    await loginAs(page, DIEGO);
    await startTransfer(page, "100");

    await expect(page.getByText("Aún no tienes contactos guardados")).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar nuevo destinatario" })).toBeVisible();
  });

  test("the error scenario fails the contacts and the balance, and Reintentar recovers", async ({ page, context }) => {
    await loginAs(page, MARIANA);
    await startTransfer(page, "100");
    await setReadScenario(context, READ_SCENARIO.ERROR);
    await page.reload();

    await expect(page.getByText("No pudimos cargar tus contactos")).toBeVisible();
    await expect(page.getByText(/Referencia: /).first()).toBeVisible();

    await clearReadScenario(context);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("radio", { name: /^Carlos Ruiz/ })).toBeVisible();

    await setReadScenario(context, READ_SCENARIO.ERROR);
    await page.goto(ROUTES.TRANSFER_AMOUNT);
    await expect(page.getByText("No pudimos cargar tu saldo")).toBeVisible();
  });

  test("opening the review with no draft lands on the amount step", async ({ page }) => {
    await loginAs(page, MARIANA);

    await page.goto(ROUTES.TRANSFER_REVIEW);

    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_AMOUNT}$`));
  });

  test("logging out and back in starts with an empty draft", async ({ page }, testInfo) => {
    await loginAs(page, MARIANA);
    await startTransfer(page, "350");

    await page.goto(ROUTES.HOME);
    await logout(page, { mobile: testInfo.project.name === MOBILE_PROJECT });
    await expect(page).toHaveURL(/\/login$/);

    await loginAs(page, MARIANA);
    await openWizardFromHome(page);

    await expect(amountInput(page)).toHaveValue("");
  });
});

test.describe("transfer wizard desktop", () => {
  test("the stepper links back and the live summary updates", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP_PROJECT, "desktop-only stepper and live summary");

    await loginAs(page, MARIANA);
    await startTransfer(page, "350");

    const summary = page.getByRole("complementary", { name: "Resumen" });
    await expect(summary).toContainText("$350");

    await page.getByRole("radio", { name: /^Ana Torres/ }).check();
    await expect(summary).toContainText("Ana Torres");

    await page.getByRole("list", { name: "Progreso del envío" }).getByRole("link", { name: "Monto" }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_AMOUNT}$`));

    await amountInput(page).fill("500");
    await expect(summary).toContainText("$500");
    await expect(summary).toContainText("$11,950.80");
  });
});

test.describe("transfer wizard mobile", () => {
  test("the step's CTA sits in the bottom action bar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE_PROJECT, "mobile-only action bar");

    await loginAs(page, MARIANA);
    await openWizardFromHome(page);

    const button = continueButton(page);
    const box = await button.boundingBox();
    const viewport = page.viewportSize();

    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan((viewport?.height ?? 0) - 100);
  });
});
