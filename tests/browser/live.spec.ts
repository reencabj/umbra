import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
test("live Supabase: dynamic products, private photos, sales, tickets, edits, shared quotas, weekly stock, reports and mobile", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.E2E_LIVE,
    "Requires explicitly approved temporary QA account; CI runs the isolated database suite.",
  );
  test.setTimeout(180000);
  const account = JSON.parse(await readFile("work/qa-account.json", "utf8"));
  const prefix =
    "__QA_" + account.id.slice(0, 8) + "_" + Date.now().toString(36).slice(-4);
  const org = prefix + " ORG";
  const category = prefix + " CAT";
  const alpha = prefix + " ALPHA";
  const beta = prefix + " BETA";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("link", { name: "Organizaciones", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear organización", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill(org);
  await page
    .getByLabel("Identificador único")
    .fill(prefix.replaceAll("_", "Q"));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("row")
    .filter({ hasText: org })
    .getByTitle("Registrar contacto")
    .click();
  await page.getByLabel("Resultado").selectOption("No respondió");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar contacto", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Stock semanal", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear categoría", exact: true })
    .click();
  await page.getByLabel("Nombre de categoría").fill(category);
  await page.getByRole("dialog").getByLabel("Límite semanal").fill("5");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  for (const [name, white, black] of [
    [alpha, "12500", "17500"],
    [beta, "15000", "21000"],
  ]) {
    await page
      .getByRole("button", { name: "Crear producto", exact: true })
      .click();
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    await page
      .getByLabel("Categoría", { exact: true })
      .selectOption({ label: category });
    await page.getByLabel("Precio blanco", { exact: true }).fill(white);
    await page.getByLabel("Precio negro (sin lavado)").fill(black);
    if (name === alpha) {
      const image = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const c = canvas.getContext("2d")!;
        c.fillStyle = "#183c2d";
        c.fillRect(0, 0, 128, 128);
        c.fillStyle = "#00db8b";
        c.font = "bold 40px sans-serif";
        c.fillText("QA", 30, 78);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await page.getByLabel("Fotografía del producto").setInputFiles({
        name: "qa.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      });
      await expect(page.getByAltText("Vista previa")).toBeVisible();
    }
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
  }
  await expect(
    page.getByRole("row").filter({ hasText: alpha }).getByAltText(alpha),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: "Nueva venta", exact: true }).click();
  await page
    .getByLabel("Organización", { exact: true })
    .selectOption({ label: org });
  await page.getByRole("button", { name: "Negro", exact: true }).click();
  await page.getByLabel("Cantidad " + alpha, { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Confirmar pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar venta", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: /Comprobante/ })).toContainText(
    "26.250",
    {
      timeout: 30000,
    },
  );
  await page
    .getByRole("button", { name: "Copiar ticket", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "LAVADO (50%)",
  );
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const pngFile = await png;
  expect(pngFile.suggestedFilename()).toMatch(/\.png$/);
  const pngBytes = await readFile((await pngFile.path())!);
  expect(pngBytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(pngBytes.length).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: "Stock semanal", exact: true }).click();
  let row = page
    .getByRole("row")
    .filter({ hasText: org })
    .filter({ hasText: category });
  await expect(row.locator("td").nth(2)).toHaveText("1");
  await expect(row.locator("td").nth(3)).toHaveText("4");
  // Changing catalog prices must not rewrite an existing order.
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: alpha })
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await page.getByLabel("Precio negro (sin lavado)").fill("88888");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: org })
    .getByTitle("Editar pedido")
    .click();
  await page.getByLabel("Cantidad " + alpha, { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar venta", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: /Comprobante/ })).toContainText(
    "52.500",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  // Delivery retains weekly usage: no second quota deduction.
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: org })
    .getByTitle("Editar pedido")
    .click();
  await page.getByLabel("Estado del pedido").selectOption("delivered");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar venta", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: /Comprobante/ })).toContainText(
    "52.500",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: "Stock semanal", exact: true }).click();
  row = page
    .getByRole("row")
    .filter({ hasText: org })
    .filter({ hasText: category });
  await expect(row.locator("td").nth(2)).toHaveText("2");
  await expect(row.locator("td").nth(3)).toHaveText("3");
  // Shared category total: 2 existing + 4 of the other product exceeds five.
  await page.getByRole("link", { name: "Nueva venta", exact: true }).click();
  await page
    .getByLabel("Organización", { exact: true })
    .selectOption({ label: org });
  await page.getByLabel("Cantidad " + beta, { exact: true }).fill("4");
  await expect(
    page.getByLabel("Cantidad " + beta, { exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByRole("button", { name: "Agregar " + alpha, exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Agregar " + beta, exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".inline-error")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "work/qa-sales-desktop.png" });
  await page.getByRole("link", { name: "Reportes", exact: true }).click();
  await page.getByRole("button", { name: "Generar reporte" }).click();
  await expect(page.locator(".report-preview")).toContainText(
    org.toUpperCase(),
  );
  await expect(page.locator(".report-preview")).toContainText("52.500");
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar CSV" }).click();
  const csvFile = await csv;
  expect(csvFile.suggestedFilename()).toMatch(/\.csv$/);
  const csvContent = await readFile((await csvFile.path())!, "utf8");
  expect(csvContent).toContain(org);
  expect(csvContent).toContain('"52500"');
  const xlsx = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar Excel" }).click();
  const xlsxFile = await xlsx;
  expect(xlsxFile.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await xlsxFile.path())!);
  const exportedRows: unknown[][] = [];
  workbook
    .getWorksheet("Pedidos")!
    .eachRow((row) => exportedRows.push(row.values as unknown[]));
  expect(
    exportedRows.some((row) => row.includes(org) && row.includes(52500)),
  ).toBeTruthy();
  expect(workbook.getWorksheet("Productos")!.rowCount).toBeGreaterThan(1);
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: org })
    .getByTitle("Anular pedido")
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Anular pedido", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: org })).toContainText(
    "Anulada",
  );
  await page.getByRole("link", { name: "Stock semanal", exact: true }).click();
  row = page
    .getByRole("row")
    .filter({ hasText: org })
    .filter({ hasText: category });
  await expect(row.locator("td").nth(2)).toHaveText("0");
  await expect(row.locator("td").nth(3)).toHaveText("5");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Nueva venta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nueva venta", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Organización", { exact: true })
    .selectOption({ label: org });
  await expect(
    page.getByLabel("Cantidad " + alpha, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "work/qa-sales-mobile.png" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nueva venta", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
