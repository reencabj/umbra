import type { Order, OrderItem } from "./types";
import { statusLabel } from "./types";
export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function csv(orders: Order[], items: OrderItem[], name: string) {
  const records = [
    [
      "Pedido",
      "Fecha",
      "Hora UTC",
      "Organización",
      "Pago",
      "Estado",
      "Subtotal",
      "Lavado",
      "Total",
      "Productos",
    ],
    ...orders.map((o) => [
      o.number,
      o.business_date,
      o.occurred_at ?? "",
      o.organization_name,
      o.payment === "white" ? "Blanco" : "Negro",
      statusLabel[o.status],
      o.subtotal,
      o.washing,
      o.total,
      items
        .filter((i) => i.order_id === o.id)
        .map((i) => `${i.quantity} ${i.product_name}`)
        .join(", "),
    ]),
  ];
  const safe = (v: unknown) => {
    const s = String(v);
    return (
      '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
    );
  };
  download(
    new Blob(
      ["\uFEFF" + records.map((r) => r.map(safe).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    name + ".csv",
  );
}
export async function excel(orders: Order[], items: OrderItem[], name: string) {
  const ExcelJS = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Pedidos");
  sheet.columns = [
    { header: "Pedido", key: "number", width: 12 },
    { header: "Fecha", key: "business_date", width: 15 },
    { header: "Organización", key: "organization_name", width: 28 },
    { header: "Pago", key: "payment", width: 12 },
    { header: "Estado", key: "status", width: 15 },
    { header: "Subtotal", key: "subtotal", width: 18 },
    { header: "Lavado", key: "washing", width: 18 },
    { header: "Total", key: "total", width: 18 },
  ];
  orders.forEach((o) =>
    sheet.addRow({
      ...o,
      payment: o.payment === "white" ? "Blanco" : "Negro",
      status: statusLabel[o.status],
    }),
  );
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:H1";
  const detail = book.addWorksheet("Productos");
  detail.addRow([
    "Pedido",
    "Producto",
    "Cantidad",
    "Precio unitario",
    "Subtotal",
  ]);
  items
    .filter((i) => orders.some((o) => o.id === i.order_id))
    .forEach((i) =>
      detail.addRow([
        orders.find((o) => o.id === i.order_id)?.number,
        i.product_name,
        i.quantity,
        i.unit_price,
        i.quantity * i.unit_price,
      ]),
    );
  detail.columns.forEach((c) => (c.width = 24));
  const bytes = await book.xlsx.writeBuffer();
  download(
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    name + ".xlsx",
  );
}
export async function optimizePhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Usá una imagen JPG, PNG o WebP.");
  if (file.size > 15 * 1024 * 1024)
    throw Error("La imagen original debe pesar menos de 15 MB.");
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob || blob.size > 2097152)
    throw Error("No se pudo optimizar la fotografía a menos de 2 MB.");
  return blob;
}
