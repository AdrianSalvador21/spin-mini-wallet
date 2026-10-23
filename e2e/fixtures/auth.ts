import { expect, type Locator, type Page } from "@playwright/test";
import { getFirstName } from "../../src/shared/lib/format/name";
import { ROUTES } from "../../src/shared/lib/routes";

export const SESSION_COOKIE = "smw_session";
export const PASSWORD = "Spin2026";
export const MOBILE_PROJECT = "mobile";
export const DESKTOP_PROJECT = "desktop";

export const LOGIN_METHOD = {
  PHONE: "phone",
  EMAIL: "email",
} as const;

export type LoginMethod = (typeof LOGIN_METHOD)[keyof typeof LOGIN_METHOD];

export interface SeedUser {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

export const MARIANA: SeedUser = {
  fullName: "Mariana López",
  phone: "5512345678",
  email: "mariana@spin.test",
  password: PASSWORD,
};

export const DIEGO: SeedUser = {
  fullName: "Diego Ramírez",
  phone: "5587654321",
  email: "diego@spin.test",
  password: PASSWORD,
};

function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

export function uniquePhone(): string {
  return `56${randomDigits(8)}`;
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${randomDigits(6)}@spin.test`;
}

export async function loginAs(page: Page, user: SeedUser, method: LoginMethod = LOGIN_METHOD.PHONE): Promise<void> {
  await page.goto(ROUTES.LOGIN);

  if (method === LOGIN_METHOD.EMAIL) {
    await page.getByRole("radio", { name: "Email" }).check();
    await page.getByRole("textbox", { name: "Email" }).fill(user.email);
  } else {
    await page.getByLabel("Número celular", { exact: true }).fill(user.phone);
  }

  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.HOME}$`));
}

export function greetingOf(user: Pick<SeedUser, "fullName">): string {
  return `Hola, ${getFirstName(user.fullName)}`;
}

export function greetingLocator(page: Page, user: Pick<SeedUser, "fullName">, options: { mobile: boolean }): Locator {
  const text = greetingOf(user);

  return options.mobile ? page.locator("p", { hasText: text }) : page.getByRole("heading", { name: text });
}

export async function logout(page: Page, options: { mobile: boolean }): Promise<void> {
  if (options.mobile) {
    await page.getByRole("button", { name: "Abrir mi cuenta" }).click();
  }

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
}

export async function registerUser(page: Page, fullName = "Remitente Prueba"): Promise<SeedUser> {
  const user: SeedUser = { fullName, phone: uniquePhone(), email: uniqueEmail(), password: PASSWORD };

  await page.goto(ROUTES.REGISTER);
  await page.getByLabel("Nombre completo").fill(user.fullName);
  await page.getByLabel("Número celular", { exact: true }).fill(user.phone);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByLabel("Confirma tu contraseña", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.HOME}$`));

  return user;
}
