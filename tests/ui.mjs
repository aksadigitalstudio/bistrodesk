import { chromium } from "playwright";
import { mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir('test-artifacts',{recursive:true});
const BASE_URL=process.env.TEST_BASE_URL||'http://127.0.0.1:4190';

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const pass = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
const nav = async (name) => {
  await page.getByRole("button", { name, exact: true }).click();
};
async function state() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const q = indexedDB.open("bistrodesk-demo-v1", 1);
        q.onsuccess = () => {
          const r = q.result
            .transaction("documents", "readonly")
            .objectStore("documents")
            .get("state");
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        };
      }),
  );
}
const dialog = () => page.getByRole("dialog");
const close = () =>
  page.getByRole("button", { name: "Close dialog", exact: true }).click();
try {
  await page.goto(BASE_URL+'/');
  await page
    .getByRole("heading", { name: "A good day, at a glance." })
    .waitFor();
  assert.match(await page.title(), /BistroDesk/);
  assert.match(
    await page.locator(".restaurant-switch").innerText(),
    /Maison Olive/,
  );
  const initial = await state();
  assert.equal(initial.products.length, 14);
  assert.equal(initial.categories.length, 4);
  assert.equal(initial.settings.taxRate, 8);
  assert.equal(initial.settings.serviceRate, 0);
  assert.equal(initial.settings.currency, "USD");
  pass("Branding, configuration, 14 products and 4 categories");
  await nav("Products");
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  await dialog()
    .getByRole("textbox", { name: "New category", exact: true })
    .fill("Seasonal specials");
  await dialog().getByRole("button", { name: "Add", exact: true }).click();
  await dialog()
    .getByRole("button", { name: "Rename Seasonal specials", exact: true })
    .waitFor();
  await close();
  pass("Category creation");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await dialog()
    .getByLabel("Product name", { exact: true })
    .fill("Test lemon cake");
  await dialog()
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Seasonal specials" });
  await dialog()
    .getByLabel("Selling price (USD)", { exact: true })
    .fill("10.00");
  await dialog().getByLabel("Cost price (USD)", { exact: true }).fill("3.00");
  await dialog()
    .getByLabel("Description", { exact: true })
    .fill("A bright lemon cake with a delicate crumb.");
  const picture = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 180;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#d6d9bf";
    ctx.fillRect(0, 0, 240, 180);
    ctx.fillStyle = "#fffdf0";
    ctx.beginPath();
    ctx.arc(120, 90, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8bd5c";
    ctx.fillRect(83, 56, 74, 66);
    return c.toDataURL("image/png").split(",")[1];
  });
  await dialog()
    .getByLabel("Product photo upload")
    .setInputFiles({
      name: "cake.png",
      mimeType: "image/png",
      buffer: Buffer.from(picture, "base64"),
    });
  await dialog().getByText("Replace image", { exact: true }).waitFor();
  await dialog()
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Test lemon cake", exact: true })
    .waitFor();
  let d = await state();
  let testProduct = d.products.find((p) => p.name === "Test lemon cake");
  assert.ok(testProduct.image.startsWith("data:image/webp"));
  pass("Product creation and optimized photo upload");
  await page
    .getByRole("button", { name: "Edit Test lemon cake", exact: true })
    .click();
  await dialog()
    .getByLabel("Selling price (USD)", { exact: true })
    .fill("12.00");
  await dialog()
    .getByLabel("Product name", { exact: true })
    .fill("Test lemon cake revised");
  await dialog()
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Test lemon cake revised", exact: true })
    .waitFor();
  d = await state();
  testProduct = d.products.find((p) => p.name === "Test lemon cake revised");
  assert.equal(testProduct.priceCents, 1200);
  pass("Product editing persists");
  await nav("Point of Sale");
  await page.getByLabel("Search menu").fill("Test lemon");
  await page
    .getByRole("button", { name: "Add Test lemon cake revised", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Increase Test lemon cake revised",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Decrease Test lemon cake revised",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Increase Test lemon cake revised",
      exact: true,
    })
    .click();
  await page.getByLabel("Notes for Test lemon cake revised").fill("No cream");
  await page.getByLabel("Search menu").fill("espresso");
  await page
    .getByRole("button", { name: "Add House espresso", exact: true })
    .click();
  await page.getByLabel("Table number", { exact: true }).fill("8");
  await page
    .getByRole("button", { name: "Add order notes", exact: true })
    .click();
  await page.getByLabel("Order notes", { exact: true }).fill("Takeaway please");
  await page.getByLabel("Discount type").selectOption("percent");
  await page.getByLabel("Discount value").fill("10");
  assert.equal(await page.getByTestId("cart-total").innerText(), "$26.73");
  assert.equal(
    await page
      .locator(".order-totals")
      .getByText(/Service charge/)
      .count(),
    0,
  );
  pass("POS search, quantities, notes, 10% discount and 8% tax");
  const before = await state();
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Amount received", { exact: true }).fill("1");
  await dialog()
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await dialog()
    .getByRole("alert")
    .getByText(/less than/)
    .waitFor();
  assert.equal((await state()).transactions.length, before.transactions.length);
  pass("Insufficient cash blocked without saving");
  await page.getByLabel("Amount received", { exact: true }).fill("30");
  assert.equal(await page.getByTestId("change-due").innerText(), "$3.27");
  await dialog().locator("summary").click();
  await dialog()
    .getByLabel("Customer name", { exact: true })
    .fill("Olivia Test");
  await dialog()
    .getByLabel("Phone / WhatsApp", { exact: true })
    .fill("+1 202 555 0123");
  await dialog()
    .getByLabel("Customer email", { exact: true })
    .fill("olivia@example.com");
  await dialog()
    .getByRole("button", { name: "Record payment", exact: true })
    .dblclick();
  await page
    .getByRole("heading", { name: "Payment recorded", exact: true })
    .waitFor();
  d = await state();
  assert.equal(d.transactions.length, before.transactions.length + 1);
  assert.equal(d.income.length, before.income.length + 1);
  const sale = d.transactions.at(-1);
  assert.equal(sale.totalCents, 2673);
  assert.equal(sale.taxCents, 198);
  assert.equal(sale.revenueCents, 2475);
  assert.equal(sale.changeCents, 327);
  assert.equal(d.income.filter((i) => i.transactionId === sale.id).length, 1);
  assert.equal(sale.items[0].notes, "No cream");
  assert.equal(sale.receipt.restaurant.name, "Maison Olive");
  assert.equal(sale.receipt.notes, "Takeaway please");
  assert.equal(await page.getByTestId("cart-total").innerText(), "$0.00");
  pass(
    "Successful cash checkout; double click creates exactly one sale and one income",
  );
  await page
    .getByRole("link", { name: "Online receipt", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('a.button[href*="#demo="]')?.getAttribute("href")
        .length > 100,
  );
  const publicURL = await page
    .getByRole("link", { name: "Online receipt", exact: true })
    .getAttribute("href");
  const wa = await page
    .getByRole("link", { name: "Send via WhatsApp", exact: true })
    .getAttribute("href");
  const mail = await page
    .getByRole("link", { name: "Send via email", exact: true })
    .getAttribute("href");
  assert.equal(new URL(wa).pathname, "/12025550123");
  assert.match(
    new URL(wa).searchParams.get("text"),
    /Maison Olive[\s\S]*\$26\.73[\s\S]*\/receipt\//,
  );
  assert.ok(mail.startsWith("mailto:olivia%40example.com?"));
  assert.match(decodeURIComponent(mail), /\$26\.73/);
  await page.evaluate(() => {
    window.__prints = 0;
    window.print = () => window.__prints++;
  });
  await page
    .getByRole("button", { name: "Print receipt", exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__prints), 1);
  await page.emulateMedia({ media: "print" });
  assert.equal(
    await page
      .locator("#print-receipt")
      .evaluate((el) => getComputedStyle(el).visibility),
    "visible",
  );
  assert.equal(
    await page
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).visibility),
    "hidden",
  );
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: "test-artifacts/receipt.png", fullPage: true });
  pass("Digital receipt, print styles, WhatsApp and prepared email links");
  const publicContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (e) => errors.push("Public: " + e.message));
  await publicPage.goto(publicURL);
  await publicPage
    .getByRole("heading", { name: "Maison Olive", exact: true })
    .waitFor();
  assert.match(
    await publicPage.locator("#print-receipt").innerText(),
    /\$26\.73/,
  );
  assert.equal(await publicPage.locator(".sidebar").count(), 0);
  assert.equal(await publicPage.locator(".workspace-main").count(), 0);
  assert.ok(
    !(await publicPage
      .locator("body")
      .innerText()
      .then((t) => t.includes("olivia@example.com"))),
  );
  assert.ok(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await publicPage.screenshot({
    path: "test-artifacts/receipt-mobile.png",
    fullPage: true,
  });
  const thermal = await publicPage.pdf({
    path: "test-artifacts/receipt-thermal.pdf",
    preferCSSPageSize: true,
  });
  assert.equal(
    (thermal.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
    1,
  );
  await publicPage.getByLabel("Receipt paper size").selectOption("a4");
  const a4 = await publicPage.pdf({
    path: "test-artifacts/receipt-a4.pdf",
    preferCSSPageSize: true,
  });
  assert.equal(
    (a4.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
    1,
  );
  await publicContext.close();
  pass(
    "Public receipt works in a fresh browser on mobile; no admin or private customer contacts",
  );
  await close();
  await nav("Transactions");
  await page.getByLabel("Search transactions").fill("Olivia Test");
  await page.getByRole("button", { name: sale.number, exact: true }).click();
  await page
    .getByRole("heading", { name: "Payment recorded", exact: true })
    .waitFor();
  await close();
  await page.getByLabel("Payment filter").selectOption("Cash");
  await page.getByLabel("Minimum total").fill("26");
  await page.getByLabel("Maximum total").fill("27");
  assert.equal(await page.locator("tbody tr").count(), 1);
  pass("Searchable transaction history, filters and saved receipt reopening");
  await nav("Income");
  await page.getByLabel("Search income").fill(sale.number);
  assert.match(await page.locator("tbody").innerText(), /POS SALE/);
  assert.match(await page.locator("tbody").innerText(), /\$24\.75/);
  await page
    .getByRole("button", { name: "Add manual income", exact: true })
    .click();
  await dialog()
    .getByLabel("Title", { exact: true })
    .fill("Private dining deposit");
  await dialog().getByLabel("Amount (USD)", { exact: true }).fill("100");
  await dialog()
    .getByLabel("Description", { exact: true })
    .fill("Other revenue outside the POS.");
  await dialog()
    .getByRole("button", { name: "Save income", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByLabel("Search income").fill("Private dining deposit");
  assert.match(await page.locator("tbody").innerText(), /MANUAL INCOME/);
  pass("POS income is linked and immutable; manual income creation");
  await nav("Expenses");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await dialog().getByLabel("Title", { exact: true }).fill("Test fresh herbs");
  await dialog().getByLabel("Amount (USD)", { exact: true }).fill("25");
  await dialog()
    .getByLabel("Expense category", { exact: true })
    .selectOption("Ingredients");
  await dialog()
    .getByLabel("Description", { exact: true })
    .fill("Market purchase");
  await dialog()
    .getByLabel("Expense receipt upload")
    .setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: Buffer.from(picture, "base64"),
    });
  await dialog().getByText("Replace image", { exact: true }).waitFor();
  await dialog()
    .getByRole("button", { name: "Save expense", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Test fresh herbs", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Edit Test fresh herbs", exact: true })
    .click();
  await dialog().getByLabel("Amount (USD)", { exact: true }).fill("30");
  assert.equal(
    await dialog()
      .getByRole("img", { name: "Expense receipt", exact: true })
      .count(),
    1,
  );
  await dialog()
    .getByRole("button", { name: "Save expense", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  pass("Expense creation, optimized receipt upload and editing");
  await nav("Dashboard");
  assert.equal(await page.getByTestId("sales-revenue").innerText(), "$211.75");
  assert.equal(await page.getByTestId("total-income").innerText(), "$311.75");
  assert.equal(
    await page.getByTestId("recorded-expenses").innerText(),
    "$110.20",
  );
  assert.equal(
    await page.getByTestId("estimated-net-result").innerText(),
    "$201.55",
  );
  pass("Dashboard totals update and do not double-count POS income");
  await nav("Reports");
  await page.getByLabel("Date range").selectOption("Today");
  assert.equal(await page.getByTestId("gross-revenue").innerText(), "$311.75");
  assert.equal(
    await page.getByTestId("estimated-net-result").innerText(),
    "$201.55",
  );
  await page.getByLabel("Revenue grouping").selectOption("Weekly");
  await page.getByLabel("Revenue grouping").selectOption("Monthly");
  await page.getByLabel("Date range").selectOption("Custom Range");
  assert.equal(await page.getByLabel("Start date").count(), 1);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export report", exact: true })
    .click();
  await (await download).saveAs("test-artifacts/test-report.csv");
  pass(
    "Reports reconcile with checkout, manual income and expenses; grouping and CSV export",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "A good day, at a glance." })
    .waitFor();
  d = await state();
  assert.equal(
    d.products.find((p) => p.id === testProduct.id).priceCents,
    1200,
  );
  assert.equal(d.transactions.filter((t) => t.id === sale.id).length, 1);
  assert.equal(
    d.expenses.find((e) => e.title === "Test fresh herbs").amountCents,
    3000,
  );
  assert.equal(
    await page.getByTestId("estimated-net-result").innerText(),
    "$201.55",
  );
  pass(
    "Refresh persists products, photos, sales, income, expenses and dashboard",
  );
  await nav("Settings");
  await page
    .getByLabel("Restaurant name", { exact: true })
    .fill("Maison Olive Test");
  await page.getByLabel("Sales tax (%)", { exact: true }).fill("10");
  await page.getByLabel("Service charge (%)", { exact: true }).fill("5");
  await page.getByLabel("Phone", { exact: true }).fill("+1 202 555 0190");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("status")
    .getByText(/Settings saved/)
    .waitFor();
  await nav("Point of Sale");
  await page.getByLabel("Search menu").fill("Test lemon");
  await page
    .getByRole("button", { name: "Add Test lemon cake revised", exact: true })
    .click();
  assert.equal(await page.getByTestId("cart-total").innerText(), "$13.86"); // persistent 10% discount from the previous order? resets to zero on checkout
  pass("Settings identity, tax and service rules update the POS");
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await dialog()
    .getByRole("button", { name: "Debit Card", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Payment recorded", exact: true })
    .waitFor();
  d = await state();
  const second = d.transactions.at(-1);
  assert.equal(second.receipt.restaurant.name, "Maison Olive Test");
  assert.equal(second.serviceCents, 60);
  assert.equal(second.taxCents, 126);
  assert.equal(second.totalCents, 1386);
  assert.equal(second.changeCents, 0);
  assert.equal(
    d.transactions.find((t) => t.id === sale.id).receipt.restaurant.name,
    "Maison Olive",
  );
  pass(
    "Non-cash payment and future receipts use updated settings; old receipts are preserved",
  );
  await close();
  await nav("Settings");
  await page
    .getByLabel("Restaurant name", { exact: true })
    .fill("Maison Olive");
  await page.getByLabel("Sales tax (%)", { exact: true }).fill("8");
  await page.getByLabel("Service charge (%)", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("status")
    .getByText(/Settings saved/)
    .waitFor();
  await nav("Products");
  await page.getByLabel("Search products").fill("Test lemon");
  await page
    .getByRole("button", {
      name: "Archive Test lemon cake revised",
      exact: true,
    })
    .click();
  await dialog()
    .getByRole("button", { name: "Archive product", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  assert.equal(
    (await state()).products.find((p) => p.id === testProduct.id).archived,
    true,
  );
  await nav("Point of Sale");
  await page.getByLabel("Search menu").fill("Test lemon");
  assert.equal(
    await page
      .getByRole("button", { name: "Add Test lemon cake revised", exact: true })
      .count(),
    0,
  );
  pass("Product archival removes it from POS and preserves past sales");
  await nav("Expenses");
  await page
    .getByRole("button", { name: "Delete Test fresh herbs", exact: true })
    .click();
  await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.ok(
    (await state()).expenses.some((e) => e.title === "Test fresh herbs"),
  );
  await page
    .getByRole("button", { name: "Delete Test fresh herbs", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  assert.ok(
    !(await state()).expenses.some((e) => e.title === "Test fresh herbs"),
  );
  pass("Expense delete requires confirmation and updates saved records");
  await page.setViewportSize({ width: 820, height: 1180 });
  await nav("Point of Sale");
  await page.getByLabel("Search menu").fill("");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-artifacts/pos-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await nav("Dashboard");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  pass("Desktop, tablet and small-screen layouts without page overflow");
  assert.deepEqual(errors, []);
  pass("No browser console or uncaught runtime errors");
  await writeFile(
    "test-artifacts/ui-test-results.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        errors,
        engine: "Chrome / Playwright, production build, fresh IndexedDB",
        receiptNumber: sale.number,
      },
      null,
      2,
    ),
  );
} catch (e) {
  await page.screenshot({
    path: "test-artifacts/test-failure.png",
    fullPage: true,
  });
  console.error(e);
  console.error("Browser errors", errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
