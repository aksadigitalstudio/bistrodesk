import { PGlite } from "@electric-sql/pglite";
import { mkdir,readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir('test-artifacts',{recursive:true});
const db = new PGlite();
const checks = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
try {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  let schema = await readFile("supabase/schema.sql", "utf8");
  schema = schema.replace(
    "create extension if not exists pgcrypto;",
    "-- core PostgreSQL gen_random_uuid() used in this test",
  );
  await db.exec(schema);
  pass("Schema and all PL/pgSQL functions compile");
  const user = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    cat = "33333333-3333-4333-8333-333333333333",
    product = "44444444-4444-4444-8444-444444444444";
  await db.query("insert into auth.users values($1),($2)", [user, other]);
  await db.exec(
    `set role authenticated;set "request.jwt.claim.sub"='${user}';`,
  );
  const settings = {
    name: "Restaurant test",
    currency: "USD",
    taxRate: 8,
    serviceRate: 0,
    logo: "",
    address: "Test lane",
    phone: "",
    email: "",
    footer: "Thank you",
    payments: ["Cash", "Debit Card"],
  };
  const setup = (
    await db.query(
      "select public.create_restaurant($1::jsonb,$2::jsonb,$3::jsonb) id",
      [
        JSON.stringify(settings),
        JSON.stringify([{ id: cat, name: "Main Course" }]),
        JSON.stringify([
          {
            id: product,
            categoryId: cat,
            name: "Test meal",
            priceCents: 1250,
            costCents: 300,
            description: "",
            image: "",
          },
        ]),
      ],
    )
  ).rows[0].id;
  pass("Authenticated restaurant creation and membership");
  const input = {
    requestId: "55555555-5555-4555-8555-555555555555",
    lines: [{ productId: product, quantity: 2, notes: "No salt" }],
    customer: {
      name: "Test Customer",
      phone: "12345",
      email: "customer@example.com",
      table: "7",
    },
    orderNotes: "Takeaway",
    discountKind: "percent",
    discountValue: 10,
    paymentMethod: "Cash",
    receivedCents: 3000,
  };
  const sale = (
    await db.query("select public.complete_sale($1,$2::jsonb) sale", [
      setup,
      JSON.stringify(input),
    ])
  ).rows[0].sale;
  assert.equal(sale.subtotal_cents, 2500);
  assert.equal(sale.discount_cents, 250);
  assert.equal(sale.tax_cents, 180);
  assert.equal(sale.service_cents, 0);
  assert.equal(sale.total_cents, 2430);
  assert.equal(sale.change_cents, 570);
  pass("Authoritative cash checkout, 8% tax, discount and change");
  const retry = (
    await db.query("select public.complete_sale($1,$2::jsonb) sale", [
      setup,
      JSON.stringify(input),
    ])
  ).rows[0].sale;
  assert.equal(retry.id, sale.id);
  assert.equal(
    (await db.query("select count(*) n from public.transactions")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*) n from public.income")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select amount_cents from public.income")).rows[0]
      .amount_cents,
    2250,
  );
  pass("Idempotency: one transaction, one POS income, tax excluded");
  await assert.rejects(
    db.query("select public.complete_sale($1,$2::jsonb)", [
      setup,
      JSON.stringify({
        ...input,
        requestId: crypto.randomUUID(),
        receivedCents: 100,
      }),
    ]),
    /less than/,
  );
  assert.equal(
    (await db.query("select count(*) n from public.transactions")).rows[0].n,
    1,
  );
  pass("Insufficient cash rejects atomically");
  const changed = {
    ...settings,
    name: "Changed name",
    taxRate: 12,
    serviceRate: 5,
  };
  await db.query(
    "update public.restaurant_settings set data=$1,name=$2 where id=$3",
    [JSON.stringify(changed), changed.name, setup],
  );
  const later = (
    await db.query("select public.complete_sale($1,$2::jsonb) sale", [
      setup,
      JSON.stringify({
        ...input,
        requestId: crypto.randomUUID(),
        paymentMethod: "Debit Card",
      }),
    ])
  ).rows[0].sale;
  assert.equal(later.service_cents, 113);
  assert.equal(later.tax_cents, 284);
  assert.equal(later.total_cents, 2647);
  assert.notEqual(later.number, sale.number);
  assert.equal(sale.receipt_snapshot.restaurant.name, "Restaurant test");
  pass(
    "Updated pricing rules, unique invoices and immutable receipt snapshots",
  );
  await db.query("update public.restaurant_settings set data=$1 where id=$2", [
    JSON.stringify({ ...changed, timeZone: "Pacific/Kiritimati" }),
    setup,
  ]);
  const zoned = (
    await db.query("select public.complete_sale($1,$2::jsonb) sale", [
      setup,
      JSON.stringify({
        ...input,
        requestId: crypto.randomUUID(),
        paymentMethod: "Debit Card",
      }),
    ])
  ).rows[0].sale;
  const expected = (
    await db.query(
      "select (current_timestamp at time zone 'Pacific/Kiritimati')::date::text as business_day",
    )
  ).rows[0].business_day;
  assert.equal(zoned.business_date, expected);
  assert.ok(
    zoned.number.startsWith("INV-" + expected.replaceAll("-", "") + "-"),
  );
  assert.equal(
    (
      await db.query(
        "select date::text from public.income where transaction_id=$1",
        [zoned.id],
      )
    ).rows[0].date,
    expected,
  );
  pass(
    "Restaurant time zone keeps invoice day, transaction day and income date consistent",
  );
  await db.query(
    "insert into public.income(restaurant_id,title,amount_cents,date,payment_method,source,currency) values($1,$2,1000,current_date,$3,$4,$5)",
    [setup, "Other revenue", "Cash", "MANUAL INCOME", "USD"],
  );
  pass("Manual income writes allowed for the owner");
  await assert.rejects(
    db.query(
      "insert into public.income(restaurant_id,title,amount_cents,date,payment_method,source,transaction_id,currency) values($1,$2,1000,current_date,$3,$4,$5,$6)",
      [setup, "Fake POS", "Cash", "POS SALE", crypto.randomUUID(), "USD"],
    ),
    /row-level security|permission/,
  );
  await db.query(
    "update public.income set amount_cents=99999 where source='POS SALE'",
  );
  assert.equal(
    (
      await db.query(
        "select amount_cents from public.income where transaction_id=$1",
        [sale.id],
      )
    ).rows[0].amount_cents,
    2250,
  );
  pass("Direct POS-income forgery and editing blocked");
  await db.exec(`set "request.jwt.claim.sub"='${other}';`);
  assert.equal(
    (await db.query("select count(*) n from public.transactions")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*) n from public.products")).rows[0].n,
    0,
  );
  await assert.rejects(
    db.query("select public.complete_sale($1,$2::jsonb)", [
      setup,
      JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
    ]),
    /admin access/,
  );
  pass("Unrelated admin cannot read or mutate another restaurant");
  await db.exec("reset role;set role anon;set \"request.jwt.claim.sub\"='';");
  await assert.rejects(
    db.query("select * from public.transactions"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from public.receipts"),
    /permission denied/,
  );
  const receipt = (
    await db.query("select public.get_public_receipt($1) receipt", [
      sale.receipt_snapshot.token,
    ])
  ).rows[0].receipt;
  assert.equal(receipt.totalCents, 2430);
  assert.equal(receipt.customerName, "Test Customer");
  assert.ok(!JSON.stringify(receipt).includes("costCents"));
  assert.ok(!JSON.stringify(receipt).includes("customer@example.com"));
  assert.ok(!JSON.stringify(receipt).includes("12345"));
  assert.equal(
    (
      await db.query("select public.get_public_receipt($1) receipt", [
        crypto.randomUUID(),
      ])
    ).rows[0].receipt,
    null,
  );
  await assert.rejects(
    db.query("select public.complete_sale($1,$2::jsonb)", [
      setup,
      JSON.stringify(input),
    ]),
    /permission denied/,
  );
  pass(
    "Public receipt RPC exposes only customer-safe snapshot; anonymous writes blocked",
  );
  await db.exec("reset role;set role authenticated;");
  await db.exec(`set "request.jwt.claim.sub"='${user}';`);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('bistro-private',$1)",
    [setup + "/test.webp"],
  );
  await db.exec(`set "request.jwt.claim.sub"='${other}';`);
  assert.equal(
    (await db.query("select count(*) n from storage.objects")).rows[0].n,
    0,
  );
  await assert.rejects(
    db.query(
      "insert into storage.objects(bucket_id,name) values('bistro-private',$1)",
      [setup + "/forged.webp"],
    ),
    /row-level security/,
  );
  pass("Private expense-image read and upload tenant isolation");
  await writeFile(
    "test-artifacts/sql-test-results.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        engine:
          "PGlite / PostgreSQL, with auth and storage schema stubs; not a live Supabase project",
      },
      null,
      2,
    ),
  );
} finally {
  await db.close();
}
