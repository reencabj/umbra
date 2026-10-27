import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit int,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;`);
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const migrated = await db.exec(
      await readFile("supabase/migrations/" + file, "utf8"),
    );
    console.log("Applied", file, migrated.length, "statements");
  }
  const products = await db.query(
    "select count(*)::int n from public.products",
  );
  if (products.rows[0].n !== 7)
    throw Error("Migration did not seed seven products");
  const result = await db.exec(await readFile("tests/invariants.sql", "utf8"));
  if (
    !result.some((x) =>
      x.rows?.some((row) => row.result === "ALL DATABASE ASSERTIONS PASSED"),
    )
  )
    throw Error("Database assertions did not complete");
  console.log(
    "PostgreSQL invariants: " +
      result
        .filter((x) => x.rows?.some((row) => row.result))
        .map((x) => JSON.stringify(x.rows))
        .join("\n"),
  );
  console.log(
    "PASS: schema, prices, shared quotas, accumulated quotas, stock, edits, cancellation, history, RLS, idempotency and weekly reset.",
  );
} finally {
  await db.close();
}
