import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
if (process.env.E2E_LIVE !== "1")
  throw Error(
    "Requires explicitly approved temporary QA account and E2E_LIVE=1",
  );
const account = JSON.parse(await readFile("work/qa-account.json", "utf8"));
const prefix = "__QA_" + account.id.slice(0, 8);
const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const login = await db.auth.signInWithPassword({
  email: account.email,
  password: account.password,
});
if (login.error) throw login.error;
const checked = async (q) => {
  const r = await q;
  if (r.error) throw r.error;
  return r.data;
};
try {
  const products = await checked(
    db.from("products").select("*").order("created_at", { ascending: false }),
  );
  const product = products.find(
    (p) => p.name.startsWith(prefix) && p.name.endsWith(" BETA"),
  );
  assert.ok(product);
  const org = await checked(
    db
      .from("organizations")
      .select("*")
      .eq("name", product.name.replace(" BETA", " ORG"))
      .single(),
  );
  await checked(
    db.from("limit_exceptions").upsert({
      organization_id: org.id,
      category_id: product.category_id,
      weekly_limit: 1,
    }),
  );
  const payload = (orgId, status = "confirmed") => ({
    request_key: randomUUID(),
    organization_id: orgId,
    payment: "white",
    status,
    items: [{ product_id: product.id, quantity: 1 }],
  });
  const quota = await Promise.all([
    db.rpc("save_order", { p: payload(org.id) }),
    db.rpc("save_order", { p: payload(org.id) }),
  ]);
  assert.equal(quota.filter((r) => !r.error).length, 1);
  assert.match(quota.find((r) => r.error).error.message, /Cupo excedido/);
  const accepted = quota.find((r) => !r.error).data;
  await checked(db.rpc("cancel_order", { p_id: accepted, p_version: 1 }));
  console.log(
    "PASS: two simultaneous requests for the last category quota; exactly one accepted.",
  );
  const other = await checked(
    db
      .from("organizations")
      .insert({
        name: prefix + " CONCURRENT " + randomUUID().slice(0, 6),
        code: "QA-" + randomUUID(),
      })
      .select("*")
      .single(),
  );
  const before = await checked(
    db.from("products").select("physical_stock").eq("id", product.id).single(),
  );
  assert.equal(before.physical_stock, 0);
  const unlimited = await Promise.all([
    db.rpc("save_order", { p: payload(org.id, "delivered") }),
    db.rpc("save_order", { p: payload(other.id, "delivered") }),
  ]);
  assert.equal(unlimited.filter((r) => !r.error).length, 2);
  for (const result of unlimited)
    await checked(db.rpc("cancel_order", { p_id: result.data, p_version: 1 }));
  const after = await checked(
    db.from("products").select("physical_stock").eq("id", product.id).single(),
  );
  assert.equal(after.physical_stock, 0);
  console.log(
    "PASS: independent organizations can buy simultaneously with zero warehouse stock; UMBRA supply is unlimited.",
  );
  const anonymous = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const denial = await anonymous.from("orders").select("*");
  assert.ok(denial.error);
  console.log("PASS: anonymous HTTP client cannot read orders.");
} finally {
  await db.auth.signOut();
}
