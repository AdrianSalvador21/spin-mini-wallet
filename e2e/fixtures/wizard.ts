import { expect, type Locator, type Page } from "@playwright/test";
import { MOVEMENT_TYPE } from "../../src/domain/wallet/types";
import { ROUTES } from "../../src/shared/lib/routes";

export const AMOUNT_LABEL = "¿Cuánto quieres enviar?";

export function amountInput(page: Page): Locator {
  return page.getByLabel(AMOUNT_LABEL);
}

export function continueButton(page: Page): Locator {
  return page.getByRole("button", { name: /^Continuar/ });
}

export async function openWizardFromHome(page: Page): Promise<void> {
  await page.goto(ROUTES.HOME);
  await page
    .getByRole("region", { name: "Saldo disponible" })
    .getByRole("link", { name: "Enviar dinero" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_AMOUNT}$`));
  await expect(page.getByText(/^Disponible: /)).toBeVisible();
}

export async function startTransfer(page: Page, amount: string): Promise<void> {
  await openWizardFromHome(page);
  await amountInput(page).fill(amount);
  await continueButton(page).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_RECIPIENT}$`));
}

export async function pickContact(page: Page, name: string): Promise<void> {
  await page.getByRole("radio", { name: new RegExp(`^${name}`) }).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_REVIEW}$`));
}

export const RECIPIENT_PHONE = "5523456789";

export async function reachReview(page: Page, amount: string, contactName: string): Promise<void> {
  await startTransfer(page, amount);
  await page.getByRole("button", { name: "Agregar nuevo destinatario" }).click();
  await page.getByLabel("Nombre del destinatario").fill(contactName);
  await page.getByLabel("Número celular", { exact: true }).fill(RECIPIENT_PHONE);
  await continueButton(page).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.TRANSFER_REVIEW}$`));
  await expect(page.getByRole("button", { name: "Confirmar envío" })).toBeEnabled();
}

interface MovementsResponse {
  items: { type: string; transferId?: string }[];
  nextCursor: string | null;
}

export async function transferMovementCount(page: Page, transferId: string): Promise<number> {
  let count = 0;
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({ limit: "50", ...(cursor ? { cursor } : {}) });
    const response = await page.request.get(`/api/v1/wallet/movements?${query}`);
    const body = (await response.json()) as MovementsResponse;
    count += body.items.filter((item) => item.type === MOVEMENT_TYPE.TRANSFER_OUT && item.transferId === transferId).length;
    cursor = body.nextCursor;
  } while (cursor);

  return count;
}
