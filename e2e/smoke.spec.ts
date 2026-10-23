import { expect, test } from "@playwright/test";

test("sends a visitor without a session from / to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  await expect(page).toHaveTitle("Iniciar sesión · Spin Mini Wallet");
  await expect(page.getByRole("heading", { level: 1, name: "Hola de nuevo" })).toBeVisible();
});
