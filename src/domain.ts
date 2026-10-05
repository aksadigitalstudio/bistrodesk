import { CONFIG } from "./config";
import type { Data, Item, Receipt, Settings, Totals } from "./types";
export const uid = () => crypto.randomUUID();
export const today = (timeZone?: string) => dateKey(new Date(), timeZone);
export const dateKey = (date: Date, timeZone?: string) => {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export function money(cents: number, currency: string = CONFIG.currency) {
  return new Intl.NumberFormat(CONFIG.locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
export function cents(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10000000)
    throw Error("Enter a valid non-negative amount.");
  return Math.round(n * 100);
}
export const niceDate = (value: string, timeZone?: string) =>
  new Intl.DateTimeFormat(CONFIG.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: value.length === 10 ? undefined : timeZone,
  }).format(new Date(value.length === 10 ? value + "T12:00:00" : value));
export const niceTime = (value: string, timeZone?: string) =>
  new Intl.DateTimeFormat(CONFIG.locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
export function calculate(
  items: Item[],
  settings: Settings,
  kind: "amount" | "percent",
  discountValue: number,
): Totals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  if (
    !Number.isFinite(discountValue) ||
    discountValue < 0 ||
    (kind === "percent" && discountValue > 100)
  )
    throw Error(
      "Discount must be a positive amount or a percentage from 0 to 100.",
    );
  const discountCents =
    kind === "percent"
      ? Math.round((subtotalCents * discountValue) / 100)
      : Math.round(discountValue);
  if (discountCents > subtotalCents)
    throw Error("Discount cannot exceed the subtotal.");
  const base = subtotalCents - discountCents,
    serviceCents = Math.round((base * settings.serviceRate) / 100),
    taxCents = Math.round(((base + serviceCents) * settings.taxRate) / 100),
    totalCents = base + serviceCents + taxCents;
  return {
    subtotalCents,
    discountCents,
    serviceCents,
    taxCents,
    totalCents,
    revenueCents: base + serviceCents,
  };
}
export function validateSettings(s: Settings) {
  if (s.timeZone)
    new Intl.DateTimeFormat(CONFIG.locale, { timeZone: s.timeZone }).format(
      new Date(),
    );
  if (!s.name.trim() || s.name.length > 100)
    throw Error("Restaurant name is required (up to 100 characters).");
  if (!Intl.supportedValuesOf("currency").includes(s.currency))
    throw Error("Choose a recognized ISO currency code.");
  new Intl.NumberFormat(CONFIG.locale, {
    style: "currency",
    currency: s.currency,
  });
  for (const rate of [s.taxRate, s.serviceRate])
    if (!Number.isFinite(rate) || rate < 0 || rate > 100)
      throw Error("Rates must be between 0 and 100.");
  if (!s.payments.length || new Set(s.payments).size !== s.payments.length)
    throw Error("Add at least one unique payment method.");
  if (s.payments.some((p) => !p.trim() || p.length > 40))
    throw Error("Payment method names must be 1–40 characters.");
  if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
    throw Error("Enter a valid email address.");
}
export function validateRecord(collection: string, value: unknown) {
  const v = value as Record<string, unknown>;
  if (
    !v.id ||
    (typeof v.name === "string" && !v.name.trim()) ||
    (typeof v.title === "string" && !v.title.trim())
  )
    throw Error("Name or title is required.");
  if (collection === "products") {
    if (
      !v.categoryId ||
      !Number.isInteger(v.priceCents) ||
      Number(v.priceCents) <= 0 ||
      (v.costCents !== null &&
        (!Number.isInteger(v.costCents) || Number(v.costCents) < 0))
    )
      throw Error("Choose a category and enter valid prices.");
  }
  if (collection === "income" || collection === "expenses") {
    if (
      !Number.isInteger(v.amountCents) ||
      Number(v.amountCents) <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(v.date))
    )
      throw Error("A positive amount and a valid date are required.");
    if (collection === "income" && v.source !== "MANUAL INCOME")
      throw Error("POS income can only be created by checkout.");
  }
}
export function aggregate(data: Data, start: string, end: string) {
  const currency = data.settings.currency,
    inRange = (d: string) => {
      const k =
        d.length === 10 ? d : dateKey(new Date(d), data.settings.timeZone);
      return k >= start && k <= end;
    };
  const sales = data.transactions.filter(
      (t) => t.currency === currency && inRange(t.businessDate || t.createdAt),
    ),
    income = data.income.filter(
      (t) => t.currency === currency && inRange(t.date),
    ),
    expenses = data.expenses.filter(
      (t) => t.currency === currency && inRange(t.date),
    );
  const saleRevenue = sales.reduce((s, t) => s + t.revenueCents, 0),
    takings = sales.reduce((s, t) => s + t.totalCents, 0),
    manual = income
      .filter((t) => t.source === "MANUAL INCOME")
      .reduce((s, t) => s + t.amountCents, 0),
    spending = expenses.reduce((s, t) => s + t.amountCents, 0),
    gross = saleRevenue + manual,
    tax = sales.reduce((s, t) => s + t.taxCents, 0);
  const grouped = (items: { key: string; amount: number }[]) => {
    const map = new Map<string, number>();
    items.forEach((i) => map.set(i.key, (map.get(i.key) || 0) + i.amount));
    return [...map]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  };
  const products = grouped(
    sales.flatMap((t) =>
      t.items.map((i) => ({
        key: i.name,
        amount:
          i.priceCents *
          i.quantity *
          (t.subtotalCents
            ? (t.subtotalCents - t.discountCents) / t.subtotalCents
            : 1),
      })),
    ),
  );
  const productQty = grouped(
    sales.flatMap((t) =>
      t.items.map((i) => ({ key: i.name, amount: i.quantity })),
    ),
  );
  const categories = grouped(
    sales.flatMap((t) =>
      t.items.map((i) => ({
        key: i.category,
        amount:
          i.priceCents *
          i.quantity *
          (t.subtotalCents
            ? (t.subtotalCents - t.discountCents) / t.subtotalCents
            : 1),
      })),
    ),
  );
  const costKnown = sales.every((t) =>
    t.items.every((i) => i.costCents !== null),
  );
  const cogs = sales.reduce(
    (s, t) =>
      s + t.items.reduce((n, i) => n + (i.costCents || 0) * i.quantity, 0),
    0,
  );
  return {
    sales,
    income,
    expenses,
    saleRevenue,
    takings,
    manual,
    spending,
    gross,
    tax,
    net: gross - spending,
    count: sales.length,
    average: sales.length ? Math.round(takings / sales.length) : 0,
    products,
    productQty,
    categories,
    payments: grouped(
      sales.map((t) => ({ key: t.paymentMethod, amount: t.totalCents })),
    ),
    expenseCategories: grouped(
      expenses.map((t) => ({ key: t.category, amount: t.amountCents })),
    ),
    costKnown,
    cogs,
    grossProfit: saleRevenue - cogs,
  };
}
function base64url(bytes: Uint8Array) {
  let string = "";
  for (const n of bytes) string += String.fromCharCode(n);
  return btoa(string)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function receiptURL(receipt: Receipt) {
  const base = `${location.origin}/receipt/${receipt.token}`;
  if (!receipt.demo) return base;
  const safe = {
    ...receipt,
    restaurant: {
      ...receipt.restaurant,
      logo: receipt.restaurant.logo.startsWith("data:")
        ? await receiptLogo(receipt.restaurant.logo)
        : receipt.restaurant.logo,
    },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(safe));
  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  return base + "#demo=" + base64url(new Uint8Array(compressed));
}
async function receiptLogo(src: string) {
  // Include a small logo in portable demo links without embedding a full-resolution upload.
  try {
    const image = await createImageBitmap(await (await fetch(src)).blob());
    try {
      const scale = Math.min(1, 128 / Math.max(image.width, image.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.65);
    } finally {
      image.close();
    }
  } catch {
    return "";
  }
}
export async function decodeReceipt(
  encoded: string,
  token: string,
): Promise<Receipt> {
  if (encoded.length > 100000) throw Error("Invalid receipt link.");
  const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
    bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 200000) {
      await reader.cancel();
      throw Error("Receipt is too large.");
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(joined);
  const r = JSON.parse(text) as Receipt;
  if (r.restaurant?.timeZone)
    new Intl.DateTimeFormat(CONFIG.locale, {
      timeZone: r.restaurant.timeZone,
    }).format(new Date());
  if (
    r.token !== token ||
    !r.demo ||
    !Array.isArray(r.items) ||
    r.items.length > 100 ||
    !r.restaurant?.name ||
    typeof r.currency !== "string" ||
    !Intl.supportedValuesOf("currency").includes(r.currency) ||
    !Number.isFinite(new Date(r.createdAt).getTime()) ||
    !["name", "logo", "address", "phone", "email", "footer"].every(
      (k) =>
        typeof (r.restaurant as unknown as Record<string, unknown>)[k] ===
        "string",
    ) ||
    !["number", "customerName", "table", "notes", "paymentMethod"].every(
      (k) => typeof (r as unknown as Record<string, unknown>)[k] === "string",
    ) ||
    ![r.restaurant.taxRate, r.restaurant.serviceRate].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    ) ||
    ![
      r.subtotalCents,
      r.discountCents,
      r.serviceCents,
      r.taxCents,
      r.totalCents,
      r.revenueCents,
      r.receivedCents,
      r.changeCents,
    ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    r.discountCents > r.subtotalCents ||
    r.totalCents !==
      r.subtotalCents - r.discountCents + r.serviceCents + r.taxCents ||
    r.receivedCents - r.totalCents !== r.changeCents ||
    !Number.isInteger(r.totalCents) ||
    r.totalCents < 0 ||
    !r.items.every(
      (i) =>
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        typeof i.name === "string" &&
        typeof i.notes === "string" &&
        Number.isInteger(i.priceCents) &&
        i.priceCents >= 0,
    )
  )
    throw Error("This receipt link is invalid.");
  return r;
}
export const shareMessage = (r: Receipt, url: string) =>
  `${r.restaurant.name}\nReceipt ${r.number}\nTotal: ${money(r.totalCents, r.currency)}\nView your receipt: ${url}\nThank you for dining with us.`;
export function shareLinks(r: Receipt, url: string, phone = "", email = "") {
  return {
    whatsapp: `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(shareMessage(r, url))}`,
    email: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${r.restaurant.name} · Receipt ${r.number}`)}&body=${encodeURIComponent(shareMessage(r, url))}`,
  };
}
