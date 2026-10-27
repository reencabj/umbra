export type Payment = "white" | "black";
export type Status = "pending" | "confirmed" | "delivered" | "cancelled";
export interface Profile {
  id: string;
  email: string;
  role: "admin" | "operator";
  enabled: boolean;
}
export interface Settings {
  id: number;
  system_name: string;
  washing_bps: number;
  reset_day: number;
  reset_minute: number;
  timezone: string;
  ticket_footer: string;
  report_heading: string;
  ticket_compact: boolean;
  report_compact: boolean;
}
export interface Category {
  id: string;
  name: string;
  weekly_limit: number | null;
  active: boolean;
}
export interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  image_path: string | null;
  physical_stock: number;
  low_stock: number;
  active: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}
export interface Price {
  product_id: string;
  white: number;
  black: number;
}
export interface Organization {
  id: string;
  name: string;
  code: string;
  contact_status: string;
  notes: string;
  active: boolean;
  created_at: string;
}
export interface Contact {
  id: string;
  organization_id: string;
  contact_date: string;
  occurred_at: string | null;
  result: string;
  notes: string;
}
export interface LimitException {
  organization_id: string;
  category_id: string;
  weekly_limit: number | null;
}
export interface Combo {
  id: string;
  name: string;
  items: CartLine[];
  active: boolean;
}
export interface CartLine {
  product_id: string;
  quantity: number;
}
export interface Order {
  id: string;
  number: number;
  organization_id: string;
  organization_name: string;
  business_date: string;
  occurred_at: string | null;
  period_start: string;
  payment: Payment;
  status: Status;
  subtotal: number;
  washing_bps: number;
  washing: number;
  total: number;
  notes: string;
  historical: boolean;
  stock_exempt: boolean;
  version: number;
  created_at: string;
}
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  category_id: string;
  product_name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
}
export interface Movement {
  id: string;
  product_id: string;
  delta: number;
  balance: number;
  reason: string;
  order_id: string | null;
  created_at: string;
}
export interface Stock {
  id: string;
  physical_stock: number;
  reserved: number;
  available: number;
}
export interface Usage {
  organization_id: string;
  category_id: string;
  used: number;
}
export interface AuthorizedUser {
  email: string;
  role: "admin" | "operator";
  enabled: boolean;
}
export interface Data {
  settings: Settings;
  categories: Category[];
  products: Product[];
  prices: Price[];
  organizations: Organization[];
  contacts: Contact[];
  exceptions: LimitException[];
  combos: Combo[];
  orders: Order[];
  items: OrderItem[];
  movements: Movement[];
  stock: Stock[];
  usage: Usage[];
  users: AuthorizedUser[];
}
export const statusLabel: Record<Status, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  delivered: "Entregada",
  cancelled: "Anulada",
};
export const contactStatuses = [
  "Pendiente",
  "Contactada",
  "No respondió",
  "Pedido realizado",
  "Entregada",
];
