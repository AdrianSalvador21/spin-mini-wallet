import { expect, test, type Locator, type Page } from "@playwright/test";
import { TRANSFER_SCENARIO } from "../src/shared/lib/api/contract";
import { isRequestId } from "../src/shared/lib/api/request-id";
import { ROUTES } from "../src/shared/lib/routes";
import { SESSION_STORAGE_KEY } from "../src/shared/lib/session-storage/client-session";
import { DESKTOP_PROJECT, loginAs, MARIANA, MOBILE_PROJECT, registerUser, SESSION_COOKIE } from "./fixtures/auth";
import { setTransferScenario } from "./fixtures/scenario";
import {
  amountInput,
  openWizardFromHome,
  reachReview,
  RECIPIENT_PHONE,
  transferMovementCount,
} from "./fixtures/wizard";

const RECIPIENT = "Carlos Ruiz";
const RECEIPT_URL = /\/transfers\/(trf_[^/?#]+)$/;
const FOCUS_COLUMN_PX = 520;
const CLIENT_TIMEOUT_MS = 8000;
const SERVER_TIMEOUT_MS = 12_000;

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
}

declare global {
  interface Window {
    sharedReceipts: SharedData[];
  }
}

function confirmButton(page: Page): Locator {
  return page.getByRole("button", { name: "Confirmar envío" });
}

function isTransferPost(url: string, method: string): boolean {
  return method === "POST" && new URL(url).pathname === "/api/v1/transfers";
}

async function receiptId(page: Page): Promise<string> {
  await expect(page).toHaveURL(RECEIPT_URL, { timeout: 20_000 });

  return RECEIPT_URL.exec(page.url())?.[1] ?? "";
}

async function draftKey(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = window.sessionStorage.getItem(key);

    return raw ? (JSON.parse(raw).state.idempotencyKey as string | null) : null;
  }, SESSION_STORAGE_KEY.TRANSFER_DRAFT);
}

function columnOf(heading: Locator): Locator {
  return heading.locator("xpath=ancestor::div[contains(@class, 'transfer-') and not(contains(@class, '__'))][1]");
}

async function expectFocusColumn(page: Page, heading: Locator): Promise<void> {
  const box = await columnOf(heading).boundingBox();
  const viewport = page.viewportSize();

  expect(box?.width).toBeLessThanOrEqual(FOCUS_COLUMN_PX);
  expect(box?.y).toBeLessThan((viewport?.height ?? 0) / 4);
}

async function expectNoWizardChrome(page: Page): Promise<void> {
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Progreso del envío" })).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Progreso del envío" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Cancelar" })).toHaveCount(0);
}

test.describe("transfer confirmation", () => {
  test("success lands on a reloadable receipt, updates Home and starts a fresh draft", async ({
    page,
    context,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.sharedReceipts = [];
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: SharedData) => {
          window.sharedReceipts.push(data);
        },
      });
    });
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.SUCCESS);
    await reachReview(page, "100", RECIPIENT);
    const key = await draftKey(page);

    const [request] = await Promise.all([
      page.waitForRequest((candidate) => isTransferPost(candidate.url(), candidate.method())),
      confirmButton(page).click(),
    ]);
    const response = await request.response();

    expect(request.headers()["idempotency-key"]).toBe(key);
    expect(isRequestId(request.headers()["x-request-id"] ?? null)).toBe(true);
    expect(response?.headers()["x-request-id"]).toBe(request.headers()["x-request-id"]);

    const transferId = await receiptId(page);
    const title = page.getByRole("heading", { level: 1, name: "¡Envío exitoso!" });
    await expect(title).toBeVisible();
    await expect(page.getByText("$100.00")).toBeVisible();
    await expect(page.getByText(/^\d{1,2} [a-z]{3} \d{4}, \d{2}:\d{2} h$/)).toBeVisible();
    for (const label of ["Para", "Cuenta", "Folio", "Clave de rastreo"]) {
      await expect(page.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible();
    }
    const folio = page.getByText(/^SPN-\d{8}$/);
    await expect(folio).toBeVisible();
    const folioText = await folio.textContent();

    if (testInfo.project.name === DESKTOP_PROJECT) {
      await expectFocusColumn(page, title);
    } else {
      const home = await page.getByRole("link", { name: "Volver al inicio" }).boundingBox();
      expect((home?.y ?? 0) + (home?.height ?? 0)).toBeGreaterThan((page.viewportSize()?.height ?? 0) - 120);
    }

    await page.getByRole("button", { name: "Compartir comprobante" }).click();
    const shared = await page.evaluate(() => window.sharedReceipts);
    expect(shared).toHaveLength(1);
    expect(shared[0].url).toBeUndefined();
    expect(shared[0].text).toContain(folioText ?? "");
    expect(shared[0].text).toContain("•••• 6789");
    expect(shared[0].text).not.toContain(RECIPIENT_PHONE);
    expect(shared[0].text).not.toMatch(/https?:|\/transfers\//);

    await page.reload();
    await expect(page.getByText(folioText ?? "")).toBeVisible();

    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.HOME}$`));
    await expect(page.getByRole("region", { name: "Saldo disponible" })).toContainText("$900.00");
    expect(await transferMovementCount(page, transferId)).toBe(1);

    await page.locator(`a[href="/transfers/${transferId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/transfers/${transferId}$`));
    await expect(page.getByText(folioText ?? "")).toBeVisible();

    await openWizardFromHome(page);
    await expect(amountInput(page)).toHaveValue("");
  });

  test("the browser back button from the receipt does not return to the review", async ({ page, context }) => {
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.SUCCESS);
    await reachReview(page, "50", RECIPIENT);

    await confirmButton(page).click();
    await receiptId(page);
    await page.goBack();

    await expect(page).not.toHaveURL(new RegExp(`${ROUTES.TRANSFER_REVIEW}$`));
  });

  test("a double click on Confirmar envío sends exactly one request", async ({ page, context }) => {
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.SUCCESS);
    await reachReview(page, "20", RECIPIENT);
    let posts = 0;
    page.on("request", (request) => {
      if (isTransferPost(request.url(), request.method())) {
        posts += 1;
      }
    });

    await confirmButton(page).dblclick();
    const transferId = await receiptId(page);

    expect(posts).toBe(1);
    expect(await transferMovementCount(page, transferId)).toBe(1);
  });

  test("a network error shows its reference, and retrying under success charges once", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.NETWORK_ERROR);
    await reachReview(page, "30", RECIPIENT);

    await confirmButton(page).click();

    const title = page.getByRole("heading", { level: 1, name: "Se perdió la conexión" });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page.getByRole("button", { name: "Reintentar envío" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await expect(page.getByText("Referencia:")).toBeVisible();
    await expectNoWizardChrome(page);

    const copy = page.getByRole("button", { name: "Copiar referencia" });
    await copy.click();
    await expect(copy).toHaveText("Copiado");

    await setTransferScenario(context, TRANSFER_SCENARIO.SUCCESS);
    await page.getByRole("button", { name: "Reintentar envío" }).click();
    const transferId = await receiptId(page);

    expect(await transferMovementCount(page, transferId)).toBe(1);

    await context.clearCookies({ name: SESSION_COOKIE });
    await loginAs(page, MARIANA);
    await page.goto(`/transfers/${transferId}`);
    await expect(page.getByText("No encontramos este comprobante")).toBeVisible();
  });

  test("insufficient funds shows the balance and Cambiar monto keeps the amount", async ({ page, context }) => {
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.INSUFFICIENT_FUNDS);
    await reachReview(page, "10", RECIPIENT);

    await confirmButton(page).click();

    await expect(page.getByRole("heading", { level: 1, name: "Saldo insuficiente" })).toBeVisible();
    await expect(page.getByText(/Tu saldo disponible es \$1,000\.00/)).toBeVisible();
    await expect(page.getByText("Referencia:")).toHaveCount(0);

    await page.getByRole("button", { name: "Cambiar monto" }).click();

    await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_AMOUNT}$`));
    await expect(amountInput(page)).toHaveValue(/^10(\.00)?$/);
  });

  test("a timeout shows the status lookup, which finds the transfer once the server finishes", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.TIMEOUT);
    await reachReview(page, "40", RECIPIENT);

    const startedAt = Date.now();
    await confirmButton(page).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Enviando $40.00 a Carlos");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await expect(page.getByRole("heading", { level: 1, name: "Está tardando más de lo normal" })).toBeVisible({
      timeout: SERVER_TIMEOUT_MS,
    });
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(CLIENT_TIMEOUT_MS - 1000);
    expect(elapsed).toBeLessThanOrEqual(CLIENT_TIMEOUT_MS + 2000);
    await expect(page.getByText("Referencia:")).toBeVisible();

    await page.getByRole("button", { name: "Revisar estado del envío" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Todavía no encontramos tu envío" })).toBeVisible();

    await page.waitForTimeout(Math.max(0, startedAt + SERVER_TIMEOUT_MS + 1500 - Date.now()));
    await page.getByRole("button", { name: "Revisar de nuevo" }).click();
    const transferId = await receiptId(page);

    expect(await transferMovementCount(page, transferId)).toBe(1);
  });

  test("leaving the page while the transfer is processing asks for confirmation", async ({ page, context }) => {
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.TIMEOUT);
    await reachReview(page, "15", RECIPIENT);

    await confirmButton(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const prompt = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const beforeUnload = await prompt;

    expect(beforeUnload.type()).toBe("beforeunload");
    await beforeUnload.dismiss();
  });

  test("an unknown error offers only Volver al inicio and keeps the draft and its key", async ({
    page,
    context,
  }, testInfo) => {
    await registerUser(page);
    await setTransferScenario(context, TRANSFER_SCENARIO.UNKNOWN_ERROR);
    await reachReview(page, "25", RECIPIENT);
    const key = await draftKey(page);

    await confirmButton(page).click();

    const title = page.getByRole("heading", { level: 1, name: "Algo salió mal" });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page.getByText("Referencia:")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar envío" })).toHaveCount(0);
    await expectNoWizardChrome(page);
    if (testInfo.project.name === DESKTOP_PROJECT) {
      await expectFocusColumn(page, title);
    }

    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.HOME}$`));

    await page.goto(ROUTES.TRANSFER_REVIEW);
    await expect(confirmButton(page)).toBeVisible();
    expect(await draftKey(page)).toBe(key);
  });

  test("an unknown or foreign receipt id shows the not-found screen", async ({ page }, testInfo) => {
    await registerUser(page);

    await page.goto("/transfers/trf_does_not_exist");

    await expect(page.getByText("No encontramos este comprobante")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", ROUTES.HOME);
    if (testInfo.project.name === MOBILE_PROJECT) {
      await expect(page.getByRole("banner")).toHaveCount(0);
    }
  });
});
