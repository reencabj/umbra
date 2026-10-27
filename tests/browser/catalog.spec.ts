import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  test.skip(
    Boolean(process.env.E2E_URL),
    "Isolated UI fixtures only run locally.",
  );
  const user = {
    id: "fixture-user",
    email: "test@example.invalid",
    role: "authenticated",
    aud: "authenticated",
  };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString(
      "base64url",
    ) +
    ".fixture";
  const names = [
    "Pistola Puissance",
    "Pistola .50",
    "Balas",
    "Cargador Puissance",
    "Cargador .50",
    "Chaleco",
    "Placa azul",
  ];
  const categories = [
    "Pistolas",
    "Cargadores",
    "Balas",
    "Chalecos",
    "Placas",
  ].map((name, i) => ({
    id: "cat-" + i,
    name,
    weekly_limit: [5, 15, 250, 15, 15][i],
    active: true,
  }));
  const products = names.map((name, i) => ({
    id: "p-" + i,
    name,
    category_id: "cat-" + [0, 0, 2, 1, 1, 3, 4][i],
    active: true,
    archived: false,
    image_path: null,
  }));
  const organizations = ["Families", "Requiem"].map((name, i) => ({
    id: "org-" + i,
    name,
    code: name,
    active: true,
    contact_status: "Contactada",
    notes: "",
  }));
  const tables: Record<string, unknown[]> = {
    profiles: [{ ...user, enabled: true, role: "admin" }],
    settings: [
      {
        id: 1,
        system_name: "UMBRA",
        reset_day: 1,
        reset_minute: 0,
        timezone: "America/Argentina/Buenos_Aires",
        washing_bps: 5000,
      },
    ],
    products,
    categories,
    organizations,
    prices: products.map((p, i) => ({
      product_id: p.id,
      white: [12500, 15000, 60, 500, 500, 300, 2000][i],
      black: [17500, 21000, 84, 700, 700, 420, 2800][i],
    })),
    combos: [
      {
        id: "combo",
        name: "Dúo",
        active: true,
        items: [
          { product_id: "p-0", quantity: 3 },
          { product_id: "p-1", quantity: 2 },
        ],
      },
    ],
    orders: [
      {
        id: "template",
        organization_id: "org-1",
        status: "cancelled",
        payment: "white",
        notes: "",
        number: 7,
        organization_name: "Requiem",
        business_date: "2026-10-27",
        occurred_at: null,
        subtotal: 67500,
        washing: 0,
        total: 67500,
        washing_bps: 0,
      },
    ],
    order_items: [
      {
        order_id: "template",
        product_id: "p-0",
        product_name: names[0],
        quantity: 3,
        unit_price: 12500,
      },
      {
        order_id: "template",
        product_id: "p-1",
        product_name: names[1],
        quantity: 2,
        unit_price: 15000,
      },
    ],
    limit_exceptions: [
      { organization_id: "org-1", category_id: "cat-0", weekly_limit: 1 },
    ],
  };
  await page.addInitScript(
    ({ token, expires, user }) => {
      localStorage.setItem(
        "sb-qfkvqptdibzoxvskmkqq-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          expires_at: expires,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { token, expires, user },
  );
  // Intercept all Supabase requests: these tests never use or change real data.
  await page.route("https://*.supabase.co/**", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
      });
    if (route.request().method() !== "GET")
      throw Error("Unexpected backend write in UI fixture");
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        url.pathname.startsWith("/auth/")
          ? user
          : tables[url.pathname.split("/").at(-1)!] || [],
      ),
    });
  });
});

test("compact catalog blocks shared quota, typed overflow, combos and smaller organization allowances", async ({
  page,
}) => {
  await page.goto("./#/sales");
  await expect(
    page.getByRole("heading", { name: "Nueva venta", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Organización", { exact: true }).selectOption("org-0");
  const a = page.getByLabel("Cantidad Pistola Puissance", { exact: true });
  const b = page.getByLabel("Cantidad Pistola .50", { exact: true });
  await a.fill("3");
  await b.fill("2");
  await expect(
    page.getByRole("button", {
      name: "Agregar Pistola Puissance",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Agregar Pistola .50", exact: true }),
  ).toBeDisabled();
  await a.fill("99");
  await expect(a).toHaveValue("3");
  await expect(page.locator(".inline-error")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Quitar Pistola Puissance", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Agregar Pistola .50", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Limpiar carrito" }).click();
  await page.getByRole("button", { name: "Dúo", exact: true }).click();
  await expect(a).toHaveValue("3");
  await expect(b).toHaveValue("2");
  await expect(
    page.getByRole("button", { name: "Dúo", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Organización", { exact: true }).selectOption("org-1");
  await expect(a).toHaveValue("1");
  await expect(b).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Agregar Pistola .50", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Agregar Balas", exact: true }),
  ).toBeEnabled();
  await page.goto("./#/sales?duplicate=template");
  await expect(a).toHaveValue("1");
  await expect(b).toHaveValue("0");
  const size = await page.locator(".product-card").first().boundingBox();
  expect(size!.width).toBeLessThan(190);
  expect(size!.height).toBeLessThan(210);
  await expect(page).toHaveTitle("UMBRA");
  await expect
    .poll(() =>
      page
        .locator(".sidebar .umbra-logo")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(1254);
  await expect(
    page.getByRole("link", { name: "Stock semanal", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText("VENTAS & CUPOS", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({ path: "work/catalog-desktop.png", fullPage: true });
  await page.goto("./#/inventory");
  await expect(
    page.getByRole("heading", { name: "Stock semanal", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/limits$/);
});

test("ticket includes the original logo and exports its PNG", async ({
  page,
}) => {
  await page.goto("./#/orders");
  await page.getByTitle("Ver comprobante", { exact: true }).click();
  const logo = page.locator("#ticket-export .umbra-logo");
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1254);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const png = await download;
  await png.saveAs("work/ticket-logo.png");
  expect(
    (await readFile("work/ticket-logo.png")).subarray(0, 8).toString("hex"),
  ).toBe("89504e470d0a1a0a");
});

test("mobile catalog keeps three compact columns and a reachable menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/sales");
  await expect(
    page.getByRole("heading", { name: "Nueva venta", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Organización", { exact: true }).selectOption("org-0");
  const first = await page.locator(".product-card").nth(0).boundingBox();
  const third = await page.locator(".product-card").nth(2).boundingBox();
  expect(first!.y).toBe(third!.y);
  expect(first!.width).toBeLessThan(120);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "work/catalog-mobile.png", fullPage: true });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(
    page.getByRole("button", { name: "Abrir menú" }),
  ).toBeInViewport();
});
