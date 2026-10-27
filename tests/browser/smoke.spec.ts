import { test, expect } from "@playwright/test";
test("private login and account activation render on desktop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ingresar", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Primera vez · Activar cuenta autorizada" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Activar mi cuenta" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Al menos 12 caracteres")).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile login has no horizontal overflow and refresh works on hash routes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/sales");
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
