import { expect, test } from "@playwright/test";

test("serves the branded base page", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  await expect(page).toHaveTitle("Spin Mini Wallet");
  await expect(page.getByRole("img", { name: "Spin by OXXO" })).toBeVisible();
});
