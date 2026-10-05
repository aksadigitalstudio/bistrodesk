export interface Settings {
  timeZone?: string;
  name: string;
  currency: string;
  taxRate: number;
  serviceRate: number;
  logo: string;
  address: string;
  phone: string;
  email: string;
  footer: string;
  payments: string[];
}
export interface Category {
  id: string;
  name: string;
}
export interface Product {
  id: string;
  name: string;
  categoryId: string;
  priceCents: number;
  costCents: number | null;
  description: string;
  image: string;
  available: boolean;
  archived: boolean;
}
export interface CartLine {
  productId: string;
  quantity: number;
  notes: string;
}
export interface Item {
  productId: string;
  name: string;
  category: string;
  priceCents: number;
  costCents: number | null;
  quantity: number;
  notes: string;
}
export interface Customer {
  name: string;
  phone: string;
  email: string;
  table: string;
  notes: string;
}
export interface Totals {
  subtotalCents: number;
  discountCents: number;
  serviceCents: number;
  taxCents: number;
  totalCents: number;
  revenueCents: number;
}
export interface Receipt extends Totals {
  token: string;
  number: string;
  createdAt: string;
  currency: string;
  restaurant: Omit<Settings, "payments" | "currency">;
  items: Omit<Item, "costCents" | "productId" | "category">[];
  customerName: string;
  table: string;
  notes: string;
  paymentMethod: string;
  receivedCents: number;
  changeCents: number;
  demo: boolean;
}
export interface Sale extends Totals {
  businessDate?: string;
  id: string;
  requestId: string;
  number: string;
  createdAt: string;
  currency: string;
  customer: Customer;
  items: Item[];
  paymentMethod: string;
  receivedCents: number;
  changeCents: number;
  status: "Completed";
  receipt: Receipt;
}
export interface Income {
  id: string;
  title: string;
  amountCents: number;
  date: string;
  paymentMethod: string;
  description: string;
  source: "POS SALE" | "MANUAL INCOME";
  transactionId: string | null;
  currency: string;
}
export interface Expense {
  id: string;
  title: string;
  category: string;
  amountCents: number;
  date: string;
  paymentMethod: string;
  description: string;
  image: string;
  currency: string;
}
export interface Data {
  settings: Settings;
  categories: Category[];
  products: Product[];
  transactions: Sale[];
  income: Income[];
  expenses: Expense[];
}
export interface Checkout {
  requestId: string;
  lines: CartLine[];
  customer: Customer;
  orderNotes: string;
  discountKind: "amount" | "percent";
  discountValue: number;
  paymentMethod: string;
  receivedCents: number;
}
export type Collection = "products" | "categories" | "income" | "expenses";
export interface Repository {
  mode: "demo" | "cloud";
  load(): Promise<Data>;
  save(
    collection: Collection,
    value: Product | Category | Income | Expense,
  ): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  settings(value: Settings): Promise<void>;
  checkout(input: Checkout): Promise<Sale>;
  upload(file: File, privateFile?: boolean): Promise<string>;
}
