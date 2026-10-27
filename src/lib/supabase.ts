import { createClient } from "@supabase/supabase-js";
export const recoveryLink = window.location.hash.includes("type=recovery");
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const db = createClient(
  url || "https://unconfigured.supabase.co",
  key || "unconfigured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
export async function rows<T>(table: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(table).select("*");
    const columns =
      table === "prices"
        ? ["product_id"]
        : table === "authorized_users"
          ? ["email"]
          : ["weekly_usage", "limit_exceptions"].includes(table)
            ? ["organization_id", "category_id"]
            : ["id"];
    for (const column of columns) query = query.order(column);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error;
    result.push(...(data as T[]));
    if (data.length < 1000) return result;
  }
}
export async function rpc<T = unknown>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function saveRow(table: string, value: object) {
  const { error } = await db.from(table).upsert(value);
  if (error) throw error;
}
