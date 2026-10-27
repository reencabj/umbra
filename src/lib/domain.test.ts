import { describe, it, expect } from "vitest";
import { totals, weekWindow, ticket, report } from "./domain";
import type { Order, OrderItem, Settings } from "./types";
const s = {
  reset_day: 1,
  reset_minute: 0,
  system_name: "UMBRA",
  washing_bps: 5000,
  ticket_footer: "Gracias",
  report_heading: "VENTAS",
  report_compact: true,
} as Settings;
const order = {
  id: "a",
  number: 1,
  organization_name: "SM13",
  business_date: "2026-10-27",
  occurred_at: null,
  payment: "white",
  status: "delivered",
  subtotal: 124500,
  washing: 0,
  total: 124500,
  washing_bps: 0,
} as Order;
const items = [
  {
    order_id: "a",
    product_name: "Pistola Puissance",
    product_id: "p",
    quantity: 3,
    unit_price: 12500,
  },
] as OrderItem[];
describe("exact money", () => {
  it("white has no washing", () =>
    expect(
      totals(
        [
          { quantity: 3, unit_price: 12500 },
          { quantity: 2, unit_price: 15000 },
        ],
        "white",
        5000,
      ),
    ).toEqual({ subtotal: 67500, washing: 0, total: 67500 }));
  it("black adds 50% once", () =>
    expect(totals([{ quantity: 1, unit_price: 17500 }], "black", 5000)).toEqual(
      { subtotal: 17500, washing: 8750, total: 26250 },
    ));
  it("rounds half up at order level", () =>
    expect(totals([{ quantity: 3, unit_price: 1 }], "black", 5000)).toEqual({
      subtotal: 3,
      washing: 2,
      total: 5,
    }));
  it("rejects non-integers", () =>
    expect(() =>
      totals([{ quantity: 1.2, unit_price: 1 }], "white", 0),
    ).toThrow());
  it("rejects overflow", () =>
    expect(() =>
      totals([{ quantity: 1000000, unit_price: 1000000000 }], "black", 5000),
    ).toThrow());
});
describe("weekly schedule Argentina", () => {
  it("Sunday stays in previous week", () =>
    expect(
      weekWindow(s, new Date("2026-10-26T02:59:59Z")).start.toISOString(),
    ).toBe("2026-10-19T03:00:00.000Z"));
  it("Monday 00:00 resets", () =>
    expect(
      weekWindow(s, new Date("2026-10-26T03:00:00Z")).start.toISOString(),
    ).toBe("2026-10-26T03:00:00.000Z"));
  it("supports a custom day/time", () =>
    expect(
      weekWindow(
        { ...s, reset_day: 3, reset_minute: 930 },
        new Date("2026-10-28T18:29:59Z"),
      ).start.toISOString(),
    ).toBe("2026-10-21T18:30:00.000Z"));
});
describe("tickets and reports", () => {
  it("does not fabricate historical time", () => {
    expect(ticket(order, items, s)).toContain("hora no registrada");
    expect(ticket(order, items, s)).toContain("SM13");
  });
  it("black ticket separates surcharge", () =>
    expect(
      ticket(
        {
          ...order,
          payment: "black",
          washing: 8750,
          washing_bps: 5000,
          total: 26250,
        },
        items,
        s,
      ),
    ).toContain("LAVADO (50%)"));
  it("excludes cancelled and pending from revenue, includes records", () => {
    const result = report(
      "2026-10-27",
      [
        order,
        { ...order, id: "b", status: "cancelled" },
        { ...order, id: "c", status: "pending" },
      ],
      items,
      [],
      [],
      s,
    );
    expect(result.total).toBe(124500);
    expect(result.selected).toHaveLength(3);
  });
  it("keeps black subtotal and washing separate", () => {
    const result = report(
      "2026-10-27",
      [
        {
          ...order,
          payment: "black",
          subtotal: 17500,
          washing: 8750,
          total: 26250,
        },
      ],
      items,
      [],
      [],
      s,
      "black",
    );
    expect(result.black).toBe(17500);
    expect(result.washing).toBe(8750);
    expect(result.total).toBe(26250);
  });
});
