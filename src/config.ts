// The five supplied configuration values live here and nowhere else.
export const CONFIG = Object.freeze({
  appName: "BistroDesk",
  restaurantName: "Maison Olive",
  currency: "USD",
  locale: "en-US",
  taxRate: 8,
  serviceRate: 0,
  visualStyle:
    "Minimalist upscale bistro: off-white, dark charcoal, olive accents, subtle bronze, refined modern typography",
  theme: {
    paper: "#f5f5f0",
    surface: "#ffffff",
    nav: "#222a25",
    ink: "#26352e",
    muted: "#80877e",
    accent: "#78834b",
    accentSoft: "#eef0e3",
    bronze: "#a98b64",
    line: "#e8eae3",
  },
});
export const DEFAULT_SETTINGS = {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  name: CONFIG.restaurantName,
  currency: CONFIG.currency,
  taxRate: CONFIG.taxRate,
  serviceRate: CONFIG.serviceRate,
  logo: "",
  address: "24 Market Lane",
  phone: "",
  email: "",
  footer: "Thank you for dining with us. See you again soon.",
  payments: [
    "Cash",
    "QR payment",
    "Bank Transfer",
    "Debit Card",
    "Credit Card",
    "Other",
  ],
};
export const EXPENSE_CATEGORIES = [
  "Ingredients",
  "Utilities",
  "Salaries",
  "Rent",
  "Equipment",
  "Marketing",
  "Transportation",
  "Maintenance",
  "Other",
];
