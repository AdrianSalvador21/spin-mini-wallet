import { expect, type Locator, type Page } from "@playwright/test";
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
