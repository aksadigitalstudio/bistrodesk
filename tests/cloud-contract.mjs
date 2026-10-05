// Real production bundle against an intercepted Supabase HTTP contract; no external account is contacted.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { CONFIG, DEFAULT_SETTINGS } from "../src/config.ts";
const buildDir = path.resolve(".test-cloud-dist");
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--configLoader",
    "native",
    "--outDir",
    buildDir,
  ],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://bistrodesk-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
    encoding: "utf8",
  },
);
assert.equal(result.status, 0, result.stdout + result.stderr);
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://local").pathname;
    let file = path.resolve(buildDir, "." + pathname);
    if (!file.startsWith(buildDir + path.sep))
      file = path.join(buildDir, "index.html");
    let content;
    try {
      content = await readFile(file);
    } catch {
      file = path.join(buildDir, "index.html");
      content = await readFile(file);
    }
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".woff2": "font/woff2",
      ".svg": "image/svg+xml",
    };
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.end(content);
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((r) => server.listen(4191, "127.0.0.1", r));
const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  }),
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const pass = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
const userId = crypto.randomUUID(),
  restaurantId = crypto.randomUUID(),
  categoryId = crypto.randomUUID(),
  productId = crypto.randomUUID();
const settings = { ...DEFAULT_SETTINGS };
const transactions = [],
  income = [],
  transactionItems = [];
const products = [
  {
    id: productId,
    restaurant_id: restaurantId,
    category_id: categoryId,
    name: "Cloud test meal",
    price_cents: 1250,
    cost_cents: 300,
    description: "A fixture for contract validation.",
    image: "",
    available: true,
    archived: false,
  },
];
const mock = async (route) => {
  const u = new URL(route.request().url()),
    p = u.pathname;
  const fulfill = (json, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(json),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  if (p === "/auth/v1/token") {
    const credentials = route.request().postDataJSON();
    if (credentials.password !== "valid-password")
      return fulfill(
        {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
          msg: "Invalid login credentials",
        },
        400,
      );
    const user = {
      id: userId,
      email: credentials.email,
      aud: "authenticated",
      role: "authenticated",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = [
      enc({ alg: "HS256", typ: "JWT" }),
      enc({
        sub: userId,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      enc("mock-signature"),
    ].join(".");
    return fulfill({
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh",
      user,
    });
  }
  if (p === "/auth/v1/user")
    return fulfill({
      id: userId,
      email: "admin@example.com",
      aud: "authenticated",
      role: "authenticated",
    });
  if (p === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
  if (p === "/rest/v1/restaurant_members")
    return fulfill([{ restaurant_id: restaurantId }]);
  if (p === "/rest/v1/restaurant_settings") {
    assert.equal(u.searchParams.get("id"), "eq." + restaurantId);
    assert.equal(u.searchParams.has("restaurant_id"), false);
    return fulfill([{ id: restaurantId, name: settings.name, data: settings }]);
  }
  if (p === "/rest/v1/categories")
    return fulfill([
      { id: categoryId, restaurant_id: restaurantId, name: "Main Course" },
    ]);
  if (p === "/rest/v1/products") return fulfill(products);
  if (p === "/rest/v1/transactions") return fulfill(transactions);
  if (p === "/rest/v1/transaction_items") return fulfill(transactionItems);
  if (p === "/rest/v1/income") return fulfill(income);
  if (p === "/rest/v1/expenses") return fulfill([]);
  if (p === "/rest/v1/rpc/complete_sale") {
    const request = route.request().postDataJSON();
    assert.equal(request.p_restaurant, restaurantId);
    const input = request.p_input;
    const duplicate = transactions.find(
      (t) => t.request_id === input.requestId,
    );
    if (duplicate)
      return fulfill({
        ...duplicate,
        items: transactionItems.map(
          ({
            product_id,
            name,
            category,
            price_cents,
            cost_cents,
            quantity,
            notes,
          }) => ({
            productId: product_id,
            name,
            category,
            priceCents: price_cents,
            costCents: cost_cents,
            quantity,
            notes,
          }),
        ),
      });
    const stamp = new Date().toISOString(),
      id = crypto.randomUUID(),
      token = crypto.randomUUID(),
      items = [
        {
          productId: productId,
          name: "Cloud test meal",
          category: "Main Course",
          priceCents: 1250,
          costCents: 300,
          quantity: 1,
          notes: "",
        },
      ],
      { currency, payments, ...identity } = settings;
    const receipt = {
      token,
      number: "INV-TEST-0001",
      createdAt: stamp,
      currency,
      restaurant: identity,
      items: items.map(({ name, priceCents, quantity, notes }) => ({
        name,
        priceCents,
        quantity,
        notes,
      })),
      customerName: "",
      table: "",
      notes: "",
      paymentMethod: "Cash",
      receivedCents: 2000,
      changeCents: 650,
      subtotalCents: 1250,
      discountCents: 0,
      serviceCents: 0,
      taxCents: 100,
      totalCents: 1350,
      revenueCents: 1250,
      demo: false,
    };
    const sale = {
      id,
      restaurant_id: restaurantId,
      request_id: input.requestId,
      number: receipt.number,
      created_at: stamp,
      currency,
      customer: input.customer,
      payment_method: "Cash",
      received_cents: 2000,
      change_cents: 650,
      subtotal_cents: 1250,
      discount_cents: 0,
      service_cents: 0,
      tax_cents: 100,
      total_cents: 1350,
      revenue_cents: 1250,
      status: "Completed",
      receipt_snapshot: receipt,
    };
    transactions.push(sale);
    transactionItems.push({
      id: crypto.randomUUID(),
      restaurant_id: restaurantId,
      transaction_id: id,
      product_id: productId,
      name: items[0].name,
      category: "Main Course",
      price_cents: 1250,
      cost_cents: 300,
      quantity: 1,
      notes: "",
    });
    income.push({
      id: crypto.randomUUID(),
      restaurant_id: restaurantId,
      title: "Sale " + sale.number,
      amount_cents: 1250,
      date: stamp.slice(0, 10),
      payment_method: "Cash",
      description: "Automatically recorded",
      source: "POS SALE",
      transaction_id: id,
      currency,
    });
    return fulfill({ ...sale, items });
  }
  if (p === "/rest/v1/rpc/get_public_receipt") {
    const input = route.request().postDataJSON();
    return fulfill(
      transactions.find((t) => t.receipt_snapshot.token === input.p_token)
        ?.receipt_snapshot || null,
    );
  }
  throw Error(
    "Unexpected contract request: " + route.request().method() + " " + p,
  );
};
try {
  await page.route("https://bistrodesk-test.supabase.co/**", mock);
  await page.goto("http://127.0.0.1:4191");
  await page
    .getByRole("heading", { name: "Welcome back", exact: true })
    .waitFor();
  assert.equal(await page.locator(".sidebar").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Point of Sale", exact: true })
      .count(),
    0,
  );
  pass("Backend-enabled management requires sign-in");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("alert")
    .getByText(/Invalid login/)
    .waitFor();
  assert.equal(await page.locator(".sidebar").count(), 0);
  pass("Invalid credentials leave management locked");
  await page.getByLabel("Password", { exact: true }).fill("valid-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "A good day, at a glance." })
    .waitFor();
  assert.match(await page.locator(".mode-badge").innerText(), /Cloud/);
  assert.equal(await page.getByTestId("total-income").innerText(), "$0.00");
  pass(
    "Authorized tenant load uses correct settings ID and no fabricated financial seed",
  );
  await page
    .getByRole("button", { name: "Point of Sale", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Cloud test meal", exact: true })
    .click();
  assert.equal(await page.getByTestId("cart-total").innerText(), "$13.50");
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Amount received", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Payment recorded", exact: true })
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector('a[href*="/receipt/"]'),
  );
  const url = await page
    .getByRole("link", { name: "Online receipt", exact: true })
    .getAttribute("href");
  assert.ok(!url.includes("#demo="));
  assert.equal(transactions.length, 1);
  assert.equal(income.length, 1);
  pass(
    "Cloud RPC checkout maps snake-case records, items and immutable receipt correctly",
  );
  const publicPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await publicPage.route("https://bistrodesk-test.supabase.co/**", mock);
  await publicPage.goto(url);
  await publicPage
    .getByRole("heading", { name: CONFIG.restaurantName, exact: true })
    .waitFor();
  assert.match(
    await publicPage.locator("#print-receipt").innerText(),
    /\$13\.50/,
  );
  assert.equal(await publicPage.locator(".sidebar").count(), 0);
  await publicPage.close();
  pass("Public cloud receipt RPC works without an admin session");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  assert.equal(await page.getByTestId("total-income").innerText(), "$12.50");
  assert.equal(await page.getByTestId("sales-revenue").innerText(), "$12.50");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("heading", { name: "Welcome back", exact: true })
    .waitFor();
  assert.equal(await page.locator(".sidebar").count(), 0);
  pass(
    "Cloud financial totals exclude tax; sign-out removes private workspace",
  );
  assert.deepEqual(errors, []);
  await mkdir("test-artifacts", { recursive: true });
  await writeFile(
    "test-artifacts/cloud-contract-results.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        errors,
        mode: "Mocked Supabase HTTP contract + real browser bundle; no live Supabase service",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
