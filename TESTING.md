# Validation record

Validated on 2026-10-05 with Node.js 24.18, the production Vite build and headless Chrome. TypeScript strict checking and production build passed. **46 checks passed** across four suites. Browser suites reported no uncaught runtime errors. The main Demo Mode workflow reported no console errors; all fonts and product illustrations are local.

## Demo UI workflow — 21 checks

The suite used real UI actions to create a category and product, upload and preview a PNG converted to WebP, edit the product price/name, search POS, change quantities, enter item/order notes and table, apply a 10% discount and collect cash. A deliberately insufficient payment created no records. Repeated checkout clicks created exactly one transaction and one linked POS-income record.

The test order had a subtotal of 27.50, a discount of 2.75, taxable revenue of 24.75, sales tax of 1.98 and a total of **26.73 USD**. Receiving 30.00 produced **3.27 change**. POS income was **24.75**, excluding sales tax.

The suite reopened the digital receipt from transaction history, verified recipient/message/link encoding for WhatsApp and email, invoked the print action, checked hidden administration controls in print media, and generated **one-page thermal and A4 PDFs**. A fresh browser context loaded the portable public demo receipt on a 390px mobile viewport without administration controls or private customer contacts.

It then created manual income and an expense with an optimized evidence image, edited the expense, reconciled dashboard/reports without double-counting POS income, exported a CSV, and refreshed to confirm persistence. It changed restaurant identity and pricing rules, completed a card-recording flow, confirmed old receipt snapshots stayed unchanged, restored the original rules, archived the test product, and verified confirmed expense deletion. Desktop, 820px tablet and 390px small-screen views had no page overflow.

## Regression suite — 7 checks

Unavailable products were blocked and restored. Invalid image types and unknown currency codes were rejected. A fixed amount discount calculated correctly; a discount exceeding the subtotal disabled checkout. A EUR sale with optional walk-in customer fields reconciled separately from historical USD data. Generic WhatsApp/email links were prepared without recipients. A uploaded restaurant logo thumbnail and custom footer survived a portable receipt share. Invalid receipt links showed a customer-safe error page. No external resource requests were needed for the interface, fonts or visuals.

## PostgreSQL schema/security — 12 checks

`supabase/schema.sql` was compiled and executed with PGlite's PostgreSQL engine. Small `auth` and `storage` schema stubs supplied the Supabase-specific identity and bucket structures. These checks exercise real SQL, constraints, row-level policies and transaction functions, rather than mocking SQL execution.

Verified authenticated ownership/setup, authoritative checkout totals, tax/service/discount rounding, cash change, idempotent retries, one linked POS-income record, atomic insufficient-cash rejection, invoice uniqueness, immutable receipts, stored business time zones, manual income writes, blocked direct POS-income modification/forgery, tenant isolation, anonymous management/write denial, safe token-only receipt output, and private expense-image folder isolation.

## Supabase browser contract — 6 checks

The real cloud-configured production bundle ran against intercepted HTTP responses representing Supabase Auth/PostgREST/RPC endpoints. Verified management lock before sign-in, rejection of incorrect credentials, authorized tenant loading with the settings primary-key filter, no demo-finance insertion into cloud mode, checkout record/item mapping, server-style public receipt lookup without admin authentication, tax-excluded income totals and complete sign-out.

This is an API-contract test, **not a live Supabase connectivity, email service or storage-service test**. A real project's keys, Auth configuration, migrations and storage should be verified after provisioning.

## Artifacts and limits

Machine-readable results are in `test-artifacts/*results.json`. The folder also contains `receipt-thermal.pdf`, `receipt-a4.pdf`, mobile/tablet screenshots and a sample report CSV. Printing was verified with Chromium print CSS/PDF output, not a physical printer. Sharing was verified as correctly prepared URLs/actions; no WhatsApp message or email was sent. No payment gateway or terminal was connected. Public deployment verification is recorded separately after release.
