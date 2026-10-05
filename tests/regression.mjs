import { chromium } from "playwright";
import { mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir('test-artifacts',{recursive:true});
const BASE_URL=process.env.TEST_BASE_URL||'http://127.0.0.1:4190';
const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  }),
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } }),
  errors = [],
  checks = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("request", (r) => {
  if (
    r.url().startsWith("http") &&
    !r.url().startsWith(BASE_URL)
  )
    external.push(r.url());
});
const pass = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
const nav = (name) => page.getByRole("button", { name, exact: true }).click();
try {
  await page.goto(BASE_URL);
  await page
    .getByRole("heading", { name: "A good day, at a glance." })
    .waitFor();
  await nav("Products");
  await page.getByLabel("Search products").fill("House espresso");
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await page
    .getByRole("button", { name: "Unavailable", exact: true })
    .waitFor();
  await nav("Point of Sale");
  await page.getByLabel("Search menu").fill("House espresso");
  assert.equal(
    await page
      .getByRole("button", { name: "Add House espresso", exact: true })
      .isDisabled(),
    true,
  );
  await nav("Products");
  await page.getByLabel("Search products").fill("House espresso");
  await page.getByRole("button", { name: "Unavailable", exact: true }).click();
  await page.getByRole("button", { name: "Available", exact: true }).waitFor();
  pass("Unavailable items cannot enter the order and can be restored");
  await page
    .getByRole("button", { name: "Edit House espresso", exact: true })
    .click();
  await page
    .getByLabel("Product photo upload")
    .setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await page
    .getByRole("alert")
    .getByText(/PNG, JPEG or WebP/)
    .waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  pass("Unsupported uploads are rejected without broken images");
  await nav("Settings");
  await page.getByLabel("Currency code").fill("ZZZ");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("alert")
    .getByText(/recognized ISO/)
    .waitFor();
  await page.getByLabel("Currency code").fill("EUR");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 180;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#78834b";
    ctx.fillRect(0, 0, 180, 180);
    ctx.fillStyle = "white";
    ctx.font = "70px serif";
    ctx.fillText("M", 53, 113);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Restaurant logo upload")
    .setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page.getByText("Replace image", { exact: true }).waitFor();
  await page.getByLabel("Receipt footer").fill("Thank you for joining us!");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("status")
    .getByText(/Settings saved/)
    .waitFor();
  await nav("Dashboard");
  assert.equal(await page.getByTestId("total-income").innerText(), "€0.00");
  pass("Currency validation and currency-isolated financial reporting");
  await nav("Point of Sale");
  await page
    .getByRole("button", { name: "Add House espresso", exact: true })
    .click();
  await page.getByLabel("Discount value").fill("99");
  assert.equal(
    await page
      .getByRole("button", { name: "Proceed to checkout" })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("alert")
    .getByText(/cannot exceed/)
    .waitFor();
  await page.getByLabel("Discount value").fill("1");
  assert.equal(await page.getByTestId("cart-total").innerText(), "€2.70");
  pass("Fixed-amount discount and excessive-discount guard");
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Amount received", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Payment recorded", exact: true })
    .waitFor();
  await page.waitForFunction(() => document.querySelector('a[href*="#demo="]'));
  assert.match(
    await page.locator("#print-receipt").innerText(),
    /Thank you for joining us!/,
  );
  assert.match(await page.locator("#print-receipt").innerText(), /€2\.70/);
  const url = await page
    .getByRole("link", { name: "Online receipt", exact: true })
    .getAttribute("href");
  const wa = new URL(
    await page
      .getByRole("link", { name: "Send via WhatsApp", exact: true })
      .getAttribute("href"),
  );
  assert.equal(wa.pathname, "/");
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Send via email", exact: true })
        .getAttribute("href")
    ).startsWith("mailto:?"),
  );
  const publicPage = await browser.newPage();
  await publicPage.goto(url);
  await publicPage
    .getByRole("heading", { name: "Maison Olive", exact: true })
    .waitFor();
  assert.equal(await publicPage.locator("img.receipt-logo").count(), 1);
  assert.match(
    await publicPage.locator("#print-receipt").innerText(),
    /€2\.70/,
  );
  assert.match(
    await publicPage.locator("#print-receipt").innerText(),
    /Thank you for joining us!/,
  );
  await publicPage.close();
  pass(
    "Optional walk-in customer, generic sharing, configured currency and portable logo",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await nav("Income");
  await page.getByLabel("Filter income").selectOption("POS SALE");
  assert.match(await page.getByTestId("ledger-total").innerText(), /€2\.50/);
  await nav("Dashboard");
  assert.equal(
    await page.getByTestId("estimated-net-result").innerText(),
    "€2.50",
  );
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  pass(
    "New-currency sale reconciles; fonts and visuals need no external resources",
  );
  await page.goto(BASE_URL+'/receipt/not-a-token');
  await page.getByRole("heading", { name: "Receipt unavailable" }).waitFor();
  assert.equal(await page.locator(".sidebar").count(), 0);
  pass("Invalid public links fail gracefully without private controls");
  await writeFile(
    "test-artifacts/regression-results.json",
    JSON.stringify(
      { passed: checks.length, checks, errors, externalRequests: external },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
