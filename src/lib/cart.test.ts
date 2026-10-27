import { describe, expect, it } from "vitest";
import { fitCart, quantityLimit } from "./cart";
const products = [
  { id: "puissance", category_id: "pistols" },
  { id: "fifty", category_id: "pistols" },
  { id: "ammo", category_id: "ammo" },
];
describe("prevent category quota overflow before adding items", () => {
  it("blocks every pistol when five shared units are selected", () => {
    const cart = [
      { product_id: "puissance", quantity: 3 },
      { product_id: "fifty", quantity: 2 },
    ];
    expect(quantityLimit("puissance", cart, products, { pistols: 5 })).toBe(3);
    expect(quantityLimit("fifty", cart, products, { pistols: 5 })).toBe(2);
    expect(
      quantityLimit("ammo", cart, products, { pistols: 5, ammo: 250 }),
    ).toBe(250);
  });
  it("clamps typed quantities to the quota remaining after previous orders", () => {
    expect(
      fitCart([{ product_id: "puissance", quantity: 99 }], products, {
        pistols: 2,
      }),
    ).toEqual([{ product_id: "puissance", quantity: 2 }]);
  });
  it("fits duplicate orders and combos against one shared category allowance", () => {
    expect(
      fitCart(
        [
          { product_id: "puissance", quantity: 4 },
          { product_id: "fifty", quantity: 4 },
        ],
        products,
        { pistols: 5 },
      ),
    ).toEqual([
      { product_id: "puissance", quantity: 4 },
      { product_id: "fifty", quantity: 1 },
    ]);
  });
  it("frees shared capacity immediately when an item is removed", () => {
    expect(
      quantityLimit(
        "fifty",
        [
          { product_id: "puissance", quantity: 2 },
          { product_id: "fifty", quantity: 2 },
        ],
        products,
        { pistols: 5 },
      ),
    ).toBe(3);
  });
  it("supports unlimited exceptions and zero allowances", () => {
    expect(quantityLimit("fifty", [], products, { pistols: null })).toBe(
      1000000,
    );
    expect(
      fitCart([{ product_id: "fifty", quantity: 1 }], products, { pistols: 0 }),
    ).toEqual([]);
  });
  it("fits a cart when switching to an organization with a smaller allowance", () => {
    expect(
      fitCart(
        [
          { product_id: "puissance", quantity: 3 },
          { product_id: "fifty", quantity: 2 },
        ],
        products,
        { pistols: 1 },
      ),
    ).toEqual([{ product_id: "puissance", quantity: 1 }]);
  });
});
