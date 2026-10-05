# BistroDesk

A functional restaurant POS and finance workspace for Maison Olive. React, TypeScript and Vite provide the interface; a repository layer supports persistent browser Demo Mode and an authenticated Supabase workspace. Product illustrations, icons and fonts are bundled locally.

## Run locally

Use Node.js 22.18 or newer (Node.js 24 recommended).

```sh
npm install
npm start
```

Open **http://127.0.0.1:4190/**. `npm start` builds and serves the production application. For normal development, use `npm run dev`. To serve the included production build directly, use `npm run preview`.

The app opens in **Demo Mode** when both Supabase variables are absent. It seeds 14 products, 4 categories, sample transactions and expenses. Changes persist in IndexedDB on the current browser and origin, including optimized product photos, expense attachments and a restaurant logo. The sidebar and header identify Demo Mode. This is a local workspace, not shared cloud storage.

## Configuration

`src/config.ts` holds the five supplied configuration values: application name, restaurant name, currency, tax/service rules and visual theme. The initial configuration is BistroDesk / Maison Olive / USD / 8% sales tax / no service charge. All monetary displays use a central currency formatter with two decimal places. Interface colors are initialized as CSS variables from the configured theme.

Restaurant settings can change the restaurant identity, logo, contacts, currency, tax, service charge, receipt footer, payment methods and business time zone. New orders use current settings. Completed receipts retain their original identity, pricing rules, currency and time zone. The default time zone is detected from the browser; cloud invoice dates, transaction business dates and POS income dates use the stored restaurant time zone.

## Using the workspace

- **Dashboard:** Today, This Week, This Month and custom date ranges; sales revenue, income, recorded expenses, estimated net result, average order value, transaction count, trends, best sellers and recent receipts.
- **Point of Sale:** search and category filters; available product cards; quantity controls; item and order notes; fixed amount or percentage discounts; optional customer details; cash change and insufficient-payment validation; configurable payment methods.
- **Products:** add, edit, archive, availability controls, photo upload and preview; category creation, renaming and deletion. Historical sale items preserve their names, prices and costs.
- **Transactions:** receipt/customer search, date, payment and amount filters; reopen any saved receipt.
- **Income:** exactly one linked POS income record per completed sale; manual income creation, editing and confirmed deletion; source filtering and CSV export.
- **Expenses:** create, edit and confirmed deletion; category/date/search filters; optimized receipt-image attachments; CSV export.
- **Reports:** revenue, expenses, estimated net result, transactions and average order value; product/category/payment/expense breakdowns; daily, weekly and monthly trends; recorded item costs, gross profit and margin; date ranges and CSV export.
- **Settings:** restaurant identity and pricing controls that feed checkout, future receipts and relevant interface labels.

Payment methods record payments confirmed by the cashier. This application does not charge a card or verify a QR/bank transfer with a payment provider. Confirm those payments with the provider or terminal before selecting Record payment.

## Financial conventions

Integer cents are used for transaction calculations. Discounts apply to the subtotal. Service charge, when enabled, applies after the discount. Sales tax applies to the discounted subtotal plus any service charge. Each charge is rounded to the nearest cent.

**Sales revenue = subtotal − discount + service charge**, excluding collected sales tax. **Gross revenue = sales revenue + manual income**. **Estimated net result = gross revenue − recorded expenses**. POS-linked income is never added a second time when reporting sales. Customer payments include tax and are shown separately from revenue. Product cost and gross profit metrics are separate from the estimated net result; they are not deducted again from expense totals.

Reports include records in the currently selected currency. Changing currency does not perform an exchange-rate conversion; historical records retain their original currency and amounts.

## Receipts, printing and sharing

Every checkout creates a saved, read-only receipt at `/receipt/{random-token}`. Receipt pages are independent of management navigation and contain only the customer-facing snapshot: restaurant details, invoice, date, optional customer name/table, items, notes, totals and payment breakdown. Cost prices, private customer phone/email and business-wide financial records are excluded.

- Choose **Thermal · 80 mm** or **A4 page**, then **Print receipt**. Navigation, modal controls and sharing actions are removed from printing. Set the paper size in your printer dialog to match your device.
- **Send via WhatsApp** opens a correctly encoded prepared message, addressed to the customer number when present. With no number, it uses generic WhatsApp sharing.
- **Send via email** opens a prepared `mailto:` action, with or without a customer recipient. It requires a configured mail app and does not report email delivery.
- **Copy link** copies the online receipt URL when clipboard access is available.

In Demo Mode the full share link includes a compressed customer-safe snapshot in the URL fragment, including a small logo thumbnail. It works in another browser without access to the originating IndexedDB. Demo snapshots are clearly labeled and are not verified business records. To share over the internet, serve/deploy the app at a reachable HTTPS origin; a `127.0.0.1` link is local to your computer. Cloud receipts use only a random token and read the immutable server snapshot.

## Enable Supabase

1. Create a Supabase project. Run `supabase/schema.sql` once in its SQL editor on a fresh database.
2. Create an admin email/password account in Supabase Authentication. Use the dashboard to manage authorized accounts; the public app has no open admin signup.
3. Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

4. Restart/rebuild the application. Management pages now require sign-in. On the first authorized sign-in, **Create restaurant workspace** creates an owned restaurant with the starter categories/menu. Real cloud income, expenses and sales start empty; demo finances are never copied automatically.
5. For another admin, create their Auth account, then insert a `restaurant_members` row connecting their user UUID to the existing restaurant UUID with role `admin`. An account belongs to one restaurant. Membership writes are intentionally not exposed through the public client.

Only the client-safe publishable/anon key belongs in Vite variables. Never place a Supabase service-role key in browser code or a `VITE_` variable.

The schema includes tenant-scoped products/categories/settings/expenses/manual income, read-only completed transactions/items, a unique POS-income link, an atomic and idempotent `complete_sale` RPC, an invoice sequence, and a token-only `get_public_receipt` RPC. RLS isolates restaurants. Anonymous users have no management-table access; the public RPC returns only the receipt snapshot. Private expense images use signed URLs; product photos and restaurant logos are intentionally public. Storage uploads are restricted to the authorized restaurant folder.

The application has been tested in Demo Mode, against a mocked Supabase HTTP contract, and with the SQL running in PostgreSQL through PGlite. **A live Supabase project has not been provisioned or tested in this delivery.** Apply the schema and run a smoke checkout against your configured project before business use.

## Static deployment

Build command: `npm run build`. Output directory: `dist`. A Vercel configuration is included, with SPA rewrites for management and public receipt routes. Use Node.js 24 or 22.18+. Deploy without Supabase variables for the public browser demo, or set the two variables before building for authenticated cloud mode. For other static hosts, rewrite unknown application routes to `index.html`.

The production build runs in Demo Mode unless Supabase environment variables are configured. This repository contains the complete source and Vercel deployment configuration.

## Tests

Start the application on port 4190, then run:

```sh
npm run test:ui
npm run test:regression
npm run test:database
npm run test:cloud
```

Browser tests use an installed Chrome by default. Alternatively install Playwright Chromium (`npx playwright install chromium`) and change the launch channel for your environment. Each browser test creates a fresh browser context and does not alter your ordinary browser workspace. `test:cloud` builds a separate temporary cloud bundle, intercepts the Supabase API contract and runs its local server on port 4191; it contacts no real Supabase project.

See `TESTING.md` and `test-artifacts/` for results, receipt PDFs, responsive screenshots and report output.
