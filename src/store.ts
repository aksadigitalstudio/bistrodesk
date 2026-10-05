import { createClient } from "@supabase/supabase-js";
import {
  calculate,
  cents,
  dateKey,
  uid,
  validateRecord,
  validateSettings,
} from "./domain";
import { makeReceipt, seedData } from "./seed";
import type {
  Checkout,
  Collection,
  Data,
  Item,
  Repository,
  Sale,
} from "./types";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud = Boolean(url && key);
export const supabase = cloud ? createClient(url, key) : null;
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("bistrodesk-demo-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        Error(
          "Browser storage is unavailable. Enable site storage to use Demo Mode.",
        ),
      );
  }));
}
async function mutate<T>(action: (data: Data) => T): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("documents", "readwrite"),
      store = transaction.objectStore("documents"),
      request = store.get("state");
    let result: T;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        const data: Data = request.result || seedData();
        result = action(data);
        store.put(data, "state");
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () =>
      reject(
        failure ||
          Error("Could not save the record. No changes were committed."),
      );
    transaction.onabort = () =>
      reject(failure || Error("The save was interrupted. Please try again."));
  });
}
export async function optimizeImage(file: File): Promise<Blob> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("Choose a PNG, JPEG or WebP image under 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(Error("Unable to process image.")),
        "image/webp",
        0.83,
      ),
    );
  } finally {
    bitmap.close();
  }
}
export function blobData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Unable to read image."));
    reader.readAsDataURL(blob);
  });
}
const demo: Repository = {
  mode: "demo",
  load: () => mutate((data) => structuredClone(data)),
  save: (collection, value) =>
    mutate((data) => {
      validateRecord(collection, value);
      if (
        collection === "income" &&
        data.income.some((i) => i.id === value.id && i.source === "POS SALE")
      )
        throw Error(
          "POS income is linked to a completed transaction and cannot be edited.",
        );
      if (
        collection === "categories" &&
        data.categories.some(
          (c) =>
            c.id !== value.id &&
            c.name.toLowerCase() ===
              (value as Data["categories"][number]).name.toLowerCase(),
        )
      )
        throw Error("A category with that name already exists.");
      if (
        collection === "products" &&
        !data.categories.some(
          (c) => c.id === (value as Data["products"][number]).categoryId,
        )
      )
        throw Error("Category does not exist.");
      const records = data[collection] as { id: string }[];
      const index = records.findIndex((r) => r.id === value.id);
      if (index >= 0) records[index] = structuredClone(value);
      else records.push(structuredClone(value));
    }),
  remove: (collection, id) =>
    mutate((data) => {
      if (
        collection === "categories" &&
        data.products.some((p) => p.categoryId === id && !p.archived)
      )
        throw Error("Move or archive products in this category first.");
      if (
        collection === "income" &&
        data.income.some((i) => i.id === id && i.source === "POS SALE")
      )
        throw Error("POS income is linked to a completed transaction.");
      (data[collection] as { id: string }[]) = (
        data[collection] as { id: string }[]
      ).filter((r) => r.id !== id);
    }),
  settings: (value) =>
    mutate((data) => {
      validateSettings(value);
      data.settings = structuredClone(value);
    }),
  checkout: (input) =>
    mutate((data) => {
      const duplicate = data.transactions.find(
        (t) => t.requestId === input.requestId,
      );
      if (duplicate) return structuredClone(duplicate);
      if (!input.lines.length)
        throw Error("Add at least one item to the order.");
      if (input.lines.length > 100) throw Error("Too many items in one order.");
      if (!data.settings.payments.includes(input.paymentMethod))
        throw Error("Choose an enabled payment method.");
      if (
        input.customer.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email)
      )
        throw Error("Enter a valid customer email address.");
      const items: Item[] = input.lines.map((line) => {
        const p = data.products.find(
          (p) => p.id === line.productId && !p.archived && p.available,
        );
        if (!p)
          throw Error(
            "A product is no longer available. Update the order and try again.",
          );
        if (
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 999
        )
          throw Error("Quantity must be between 1 and 999.");
        return {
          productId: p.id,
          name: p.name,
          category:
            data.categories.find((c) => c.id === p.categoryId)?.name ||
            "Uncategorized",
          priceCents: p.priceCents,
          costCents: p.costCents,
          quantity: line.quantity,
          notes: line.notes.slice(0, 500),
        };
      });
      const totals = calculate(
        items,
        data.settings,
        input.discountKind,
        input.discountKind === "amount"
          ? cents(input.discountValue)
          : input.discountValue,
      );
      if (
        input.paymentMethod === "Cash" &&
        (!Number.isInteger(input.receivedCents) ||
          input.receivedCents < totals.totalCents)
      )
        throw Error("Amount received is less than the order total.");
      const createdAt = new Date().toISOString(),
        businessDate = dateKey(new Date(), data.settings.timeZone),
        prefix = `INV-${businessDate.replaceAll("-", "")}-`,
        next =
          1 +
          Math.max(
            0,
            ...data.transactions
              .filter((t) => t.number.startsWith(prefix))
              .map((t) => Number(t.number.slice(prefix.length))),
          );
      const sale: Omit<Sale, "receipt"> = {
        id: uid(),
        requestId: input.requestId,
        number: prefix + String(next).padStart(4, "0"),
        createdAt,
        businessDate,
        currency: data.settings.currency,
        customer: { ...input.customer, notes: input.orderNotes },
        items,
        paymentMethod: input.paymentMethod,
        receivedCents:
          input.paymentMethod === "Cash"
            ? input.receivedCents
            : totals.totalCents,
        changeCents:
          input.paymentMethod === "Cash"
            ? input.receivedCents - totals.totalCents
            : 0,
        status: "Completed",
        ...totals,
      };
      const complete = {
        ...sale,
        receipt: makeReceipt(sale, data.settings, true),
      };
      data.transactions.push(complete);
      data.income.push({
        id: uid(),
        title: `Sale ${sale.number}`,
        amountCents: sale.revenueCents,
        date: businessDate,
        paymentMethod: sale.paymentMethod,
        description: "Automatically recorded from POS. Sales tax is excluded.",
        source: "POS SALE",
        transactionId: sale.id,
        currency: sale.currency,
      });
      return structuredClone(complete);
    }),
  upload: async (file) => blobData(await optimizeImage(file)),
};
export function check<T extends { data: unknown; error: unknown }>(
  result: T,
): T["data"] {
  if (result.error) throw result.error;
  return result.data;
}
const snake = (v: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(v).map(([k, value]) => [
      k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()),
      value,
    ]),
  );
const camel = <T>(v: Record<string, unknown>): T =>
  Object.fromEntries(
    Object.entries(v)
      .filter(([k]) => k !== "restaurant_id")
      .map(([k, value]) => [
        k.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase()),
        value,
      ]),
  ) as T;
export function cloudRepository(restaurantId: string): Repository {
  const client = supabase!;
  return {
    mode: "cloud",
    load: async () => {
      const results = await Promise.all(
        [
          "restaurant_settings",
          "categories",
          "products",
          "transactions",
          "transaction_items",
          "income",
          "expenses",
        ].map((table) =>
          client
            .from(table)
            .select("*")
            .eq(
              table === "restaurant_settings" ? "id" : "restaurant_id",
              restaurantId,
            ),
        ),
      );
      results.forEach(check);
      const [
        setting,
        categories,
        products,
        transactions,
        items,
        income,
        expenses,
      ] = results.map((r) => r.data!);
      return {
        settings: setting[0].data,
        categories: categories.map((c) => camel(c)),
        products: products.map((p) => camel(p)),
        transactions: transactions.map((t) => ({
          ...camel<Sale>(t),
          items: items
            .filter((i) => i.transaction_id === t.id)
            .map((i) => camel<Item>(i)),
          receipt: t.receipt_snapshot,
        })),
        income: income.map((i) => camel(i)),
        expenses: expenses.map((e) => camel(e)),
      };
    },
    save: async (collection, value) => {
      validateRecord(collection, value);
      check(
        await client.from(collection).upsert({
          ...snake(value as unknown as Record<string, unknown>),
          restaurant_id: restaurantId,
        }),
      );
    },
    remove: async (collection, id) => {
      check(
        await client
          .from(collection)
          .delete()
          .eq("id", id)
          .eq("restaurant_id", restaurantId),
      );
    },
    settings: async (value) => {
      validateSettings(value);
      check(
        await client
          .from("restaurant_settings")
          .update({ data: value, name: value.name })
          .eq("id", restaurantId),
      );
    },
    checkout: async (input: Checkout) => {
      const result = check(
        await client.rpc("complete_sale", {
          p_restaurant: restaurantId,
          p_input: input,
        }),
      );
      return {
        ...camel<Sale>(result),
        items: result.items,
        receipt: result.receipt_snapshot,
      };
    },
    upload: async (file, privateFile = false) => {
      const image = await optimizeImage(file),
        path = `${restaurantId}/${uid()}.webp`,
        bucket = privateFile ? "bistro-private" : "bistro-public";
      check(
        await client.storage
          .from(bucket)
          .upload(path, image, { contentType: "image/webp", upsert: false }),
      );
      return privateFile
        ? "private:" + path
        : client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
  };
}
export const demoRepository = demo;
