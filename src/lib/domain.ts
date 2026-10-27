import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  Order,
  OrderItem,
  Settings,
  Payment,
  Contact,
  Organization,
} from "./types";
export const TZ = "America/Argentina/Buenos_Aires";
export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
export const today = () => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
export const localDate = (value: string) =>
  value.split("-").reverse().join("/");
export const dateTime = (o: Pick<Order, "business_date" | "occurred_at">) =>
  localDate(o.business_date) +
  (o.occurred_at
    ? " · " + formatInTimeZone(o.occurred_at, TZ, "HH:mm")
    : " · hora no registrada");
export const billable = (o: Order) =>
  o.status === "confirmed" || o.status === "delivered";
export function totals(
  lines: { quantity: number; unit_price: number }[],
  payment: Payment,
  bps: number,
) {
  let subtotal = 0n;
  for (const l of lines) {
    if (
      !Number.isSafeInteger(l.quantity) ||
      l.quantity < 0 ||
      !Number.isSafeInteger(l.unit_price) ||
      l.unit_price < 0
    )
      throw Error("Importes o cantidades inválidos");
    subtotal += BigInt(l.quantity) * BigInt(l.unit_price);
  }
  const washing =
    payment === "black" ? (subtotal * BigInt(bps) + 5000n) / 10000n : 0n;
  if (subtotal + washing > 9000000000000n)
    throw Error("El pedido supera el importe máximo permitido");
  return {
    subtotal: Number(subtotal),
    washing: Number(washing),
    total: Number(subtotal + washing),
  };
}
export function weekWindow(
  s: Pick<Settings, "reset_day" | "reset_minute">,
  now = new Date(),
) {
  const local = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const d = new Date(local + "T12:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - ((day - s.reset_day + 7) % 7));
  const hm = `${String(Math.floor(s.reset_minute / 60)).padStart(2, "0")}:${String(s.reset_minute % 60).padStart(2, "0")}`;
  let start = fromZonedTime(d.toISOString().slice(0, 10) + "T" + hm, TZ);
  if (start > now) {
    d.setUTCDate(d.getUTCDate() - 7);
    start = fromZonedTime(d.toISOString().slice(0, 10) + "T" + hm, TZ);
  }
  d.setUTCDate(d.getUTCDate() + 7);
  return {
    start,
    end: fromZonedTime(d.toISOString().slice(0, 10) + "T" + hm, TZ),
  };
}
export function ticket(
  o: Order,
  items: OrderItem[],
  s: Settings,
  compact = false,
) {
  return [
    `COMPROBANTE — ${o.organization_name}`,
    `#${String(o.number).padStart(5, "0")} · ${dateTime(o)}`,
    o.status === "cancelled"
      ? "ANULADO"
      : o.status === "pending"
        ? "PENDIENTE — SIN FACTURAR"
        : "",
    "",
    ...items.map((i) =>
      compact
        ? `${i.quantity} ${i.product_name} — ${money(i.quantity * i.unit_price)}`
        : `${i.quantity} × ${i.product_name} · ${money(i.unit_price)} = ${money(i.quantity * i.unit_price)}`,
    ),
    "",
    o.payment === "black"
      ? `SUBTOTAL NEGRO: ${money(o.subtotal)}\nLAVADO (${o.washing_bps / 100}%): ${money(o.washing)}`
      : "PAGO: BLANCO",
    `TOTAL: ${money(o.total)}`,
    s.ticket_footer,
  ]
    .filter((x, i) => x || i > 2)
    .join("\n");
}
export function report(
  date: string,
  orders: Order[],
  items: OrderItem[],
  contacts: Contact[],
  orgs: Organization[],
  s: Settings,
  filter = "all",
) {
  const selected = orders.filter(
    (o) =>
      o.business_date === date && (filter === "all" || o.payment === filter),
  );
  const billed = selected.filter(billable);
  const white = billed
    .filter((o) => o.payment === "white")
    .reduce((a, o) => a + o.total, 0);
  const black = billed
    .filter((o) => o.payment === "black")
    .reduce((a, o) => a + o.subtotal, 0);
  const washing = billed.reduce((a, o) => a + o.washing, 0);
  const noReply = [
    ...new Set(
      contacts
        .filter((c) => c.contact_date === date && c.result === "No respondió")
        .map((c) => orgs.find((o) => o.id === c.organization_id)?.name)
        .filter(Boolean),
    ),
  ];
  const text = [
    `${s.report_heading} | ${localDate(date)}`,
    "",
    ...selected.flatMap((o) => [
      `${o.organization_name.toUpperCase()} — ${money(o.total)}${!billable(o) ? ` [${o.status === "cancelled" ? "ANULADA" : "PENDIENTE"}]` : ""}`,
      items
        .filter((i) => i.order_id === o.id)
        .map((i) => `${i.quantity} ${i.product_name}`)
        .join(s.report_compact ? ", " : "\n"),
      "",
    ]),
    noReply.length ? "SIN RESPUESTA:\n" + noReply.join(", ") + "." : "",
    `BLANCO: ${money(white)}`,
    `SUBTOTAL NEGRO: ${money(black)}`,
    `LAVADO: ${money(washing)}`,
    `TOTAL DEL DÍA: ${money(white + black + washing)}`,
    "Pendientes y anuladas no se suman a la facturación.",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    text,
    selected,
    billed,
    white,
    black,
    washing,
    total: white + black + washing,
  };
}
