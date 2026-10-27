import type { CartLine } from "./types";

type CatalogItem = { id: string; category_id: string };
type Allowance = Record<string, number | null>;

export function quantityLimit(
  productId: string,
  cart: CartLine[],
  products: CatalogItem[],
  allowance: Allowance,
): number {
  const product = products.find((p) => p.id === productId);
  if (!product) return 0;
  const remaining = allowance[product.category_id];
  if (remaining == null) return 1000000;
  const otherUnits = cart.reduce((sum, line) => {
    const other = products.find((p) => p.id === line.product_id);
    return (
      sum +
      (line.product_id !== productId &&
      other?.category_id === product.category_id
        ? line.quantity
        : 0)
    );
  }, 0);
  return Math.min(1000000, Math.max(0, remaining - otherUnits));
}

export function fitCart(
  cart: CartLine[],
  products: CatalogItem[],
  allowance: Allowance,
): CartLine[] {
  const fitted: CartLine[] = [];
  for (const line of cart) {
    if (!Number.isFinite(line.quantity)) continue;
    const quantity = Math.min(
      Math.max(0, Math.floor(line.quantity)),
      quantityLimit(line.product_id, fitted, products, allowance),
    );
    if (quantity > 0) fitted.push({ ...line, quantity });
  }
  return fitted;
}
