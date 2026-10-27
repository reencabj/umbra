import { test, expect } from "@playwright/test";
test("private login and account activation render on desktop", async ({
  page,
}) => {
  const errors: string[] = [];
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  const logo = page.getByRole("img", { name: "UMBRA", exact: true });
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1254);
  expect(await page.locator('link[rel="icon"]').getAttribute("href")).toBe(
    "/umbra/umbra-logo.png",
  );
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ingresar", exact: true }),
  ).toBeVisible();
  const card = await page.locator(".auth-card").boundingBox();
  const logoBox = await logo.boundingBox();
  const heading = await page
    .getByRole("heading", { name: "Bienvenido de nuevo" })
    .boundingBox();
  expect(Math.abs(card!.x + card!.width / 2 - 960)).toBeLessThan(1);
  expect(
    Math.abs(logoBox!.x + logoBox!.width / 2 - heading!.x - heading!.width / 2),
  ).toBeLessThan(1);
  const email = await page.getByLabel("Correo electrónico").boundingBox();
  const submit = await page
    .getByRole("button", { name: "Ingresar", exact: true })
    .boundingBox();
  expect(email!.x).toBe(submit!.x);
  expect(email!.width).toBe(submit!.width);
  await page.screenshot({ path: "work/auth-desktop.png" });
  await page
    .getByRole("button", { name: "Activar cuenta", exact: true })
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
  await page.screenshot({ path: "work/auth-mobile.png" });
});
