import { DEFAULT_SETTINGS } from "./config";
import { calculate, dateKey, uid } from "./domain";
import type { Data, Item, Receipt, Sale, Settings } from "./types";

export function foodArt(kind: number) {
  const backgrounds = ["#d4d7c2", "#ddd3be", "#d2c5b4", "#c6cfbf"];
  const foods = [
    '<ellipse rx="73" ry="49" fill="#a65031"/><path d="M-55 -28Q-20 4 50 28M-50 -5Q-5 22 42 35M-32 -35Q2 -8 60 8" stroke="#693d27" stroke-width="7"/><g fill="#86a252"><circle cx="-68" cy="48" r="17"/><circle cx="-48" cy="60" r="17"/><circle cx="-78" cy="26" r="13"/></g>',
    '<g stroke="#dba85b" stroke-width="9" fill="none"><path d="M-66 -25Q45 -70 63 5T-57 44T61 -17M-52 -37Q-65 17 48 36T-38 61M-23 -53Q61 -24 -36 31T34 49"/></g><g fill="#a64429"><circle cx="-36" cy="-14" r="10"/><circle cx="42" cy="9" r="12"/><circle cx="-8" cy="43" r="9"/></g><g fill="#71844c"><ellipse cx="9" cy="-28" rx="12" ry="6" transform="rotate(24)"/><ellipse cx="-29" cy="30" rx="12" ry="6"/></g>',
    '<g fill="#709255"><ellipse cx="-25" cy="-29" rx="37" ry="20" transform="rotate(-30)"/><ellipse cx="21" cy="-22" rx="43" ry="23" transform="rotate(40)"/><ellipse cx="-9" cy="27" rx="53" ry="28"/><ellipse cx="-50" cy="21" rx="29" ry="22"/></g><g fill="#cc5a3c"><circle cx="-44" cy="-7" r="12"/><circle cx="30" cy="33" r="13"/><circle cx="43" cy="-19" r="11"/></g><g fill="#e8ddad"><rect x="-9" y="-30" width="15" height="17" transform="rotate(30)"/><rect x="-27" y="19" width="16" height="14"/><rect x="27" y="2" width="18" height="13"/></g>',
    '<ellipse rx="70" ry="51" fill="#db955e"/><g fill="#765639"><circle cx="-39" cy="-21" r="19"/><circle cx="25" cy="-19" r="23"/><circle cx="-8" cy="28" r="20"/><circle cx="45" cy="23" r="14"/></g><g stroke="#8a9b60" stroke-width="4"><path d="M-34 4L24 29M-5 -29L42 5M-50 28L-18 -5"/></g>',
    '<rect x="-63" y="-44" width="125" height="91" rx="22" fill="#bb7f47"/><rect x="-54" y="-35" width="107" height="73" rx="12" fill="#795230"/><g stroke="#342d25" stroke-width="6"><path d="M-45 -27L-7 37M-12 -34L29 38M20 -34L51 15"/></g><g fill="#859559"><circle cx="-57" cy="55" r="12"/><circle cx="-33" cy="55" r="14"/><circle cx="-77" cy="42" r="12"/></g>',
    '<ellipse cy="-1" rx="70" ry="51" fill="#d79e56"/><ellipse cy="0" rx="58" ry="39" fill="#b85332"/><g fill="#f1d69e"><ellipse cx="-26" cy="-17" rx="17" ry="13"/><ellipse cx="29" cy="-12" rx="18" ry="13"/><ellipse cx="-5" cy="20" rx="21" ry="13"/></g><g fill="#6e8d4a"><ellipse cx="-15" cy="-2" rx="9" ry="16" transform="rotate(45)"/><ellipse cx="20" cy="25" rx="8" ry="14" transform="rotate(-25)"/></g>',
    '<ellipse rx="62" ry="43" fill="#cf9a52"/><path d="M-55 -5Q-25 -42 35 -25Q67 -16 53 10Q19 35 -40 22Z" fill="#ead1a0"/><g fill="#ad6639"><circle cx="-26" cy="-4" r="7"/><circle cx="20" cy="8" r="6"/><circle cx="37" cy="-8" r="5"/></g>',
    '<g transform="rotate(-15)"><rect x="-65" y="-43" width="130" height="89" rx="12" fill="#cc9955"/><rect x="-56" y="-36" width="113" height="75" rx="8" fill="#efd4a4"/><g fill="#ac4833"><circle cx="-26" cy="-5" r="17"/><circle cx="25" cy="9" r="18"/></g><g fill="#709154"><ellipse cx="-14" cy="17" rx="15" ry="9"/><ellipse cx="32" cy="-17" rx="17" ry="10"/></g></g>',
    '<circle r="58" fill="#ece7d7" stroke="#c1bcae" stroke-width="3"/><path d="M38 -12Q89 -20 84 15T38 23" fill="none" stroke="#e8e3d5" stroke-width="15"/><circle r="45" fill="#805139"/><path d="M-22 -14Q16 -44 30 -8Q36 14 -1 30Q-37 6 -22 -14" fill="#e5c29b"/><path d="M-15 -3Q14 -25 20 -7Q20 7 -2 21Q-18 5 -15 -3" fill="none" stroke="#f1ddbd" stroke-width="4"/>',
    '<circle r="60" fill="#e8e4db" stroke="#bbbcb2" stroke-width="3"/><circle r="47" fill="#9d6237"/><path d="M42 -10Q91 -15 82 16T42 22" fill="none" stroke="#e8e4db" stroke-width="14"/><ellipse cx="-14" cy="-19" rx="23" ry="9" fill="#b78050" opacity=".8"/>',
    '<rect x="-41" y="-72" width="83" height="142" rx="16" fill="#d8e6d5" stroke="#aec2a5" stroke-width="3"/><rect x="-35" y="-55" width="71" height="117" rx="10" fill="#b8c57c"/><g fill="#eef1d3" opacity=".8"><rect x="-27" y="-44" width="26" height="29" rx="4" transform="rotate(12)"/><rect x="3" y="6" width="26" height="29" rx="4"/></g><circle cx="23" cy="-36" r="25" fill="#e8d383" stroke="#f5e5a1" stroke-width="5"/><path d="M-22 50Q-5 -12 27 -40" stroke="#6d8952" stroke-width="6" fill="none"/>',
    '<circle r="62" fill="#eee6d8"/><path d="M-46 -35L52 -25L44 45L-51 30Z" fill="#e0caa7"/><path d="M-46 -35L52 -25L44 -2L-49 -13Z" fill="#7e513b"/><path d="M-49 4L47 12L45 23L-50 15Z" fill="#9d6d4b"/><g fill="#5e4130" opacity=".6"><circle cx="-16" cy="-24" r="2"/><circle cx="22" cy="-20" r="2"/><circle cx="4" cy="-25" r="2"/></g>',
    '<circle r="61" fill="#f1ede4"/><circle r="47" fill="#d7bb82"/><circle r="40" fill="#f0dca7"/><g fill="#a94b3b"><circle cx="-18" cy="-5" r="13"/><circle cx="4" cy="-17" r="13"/><circle cx="14" cy="8" r="13"/></g><ellipse cx="-1" cy="-25" rx="16" ry="7" fill="#728f54" transform="rotate(-20)"/>',
    '<ellipse rx="59" ry="47" fill="#e8d7bc"/><circle cx="-28" cy="-13" r="24" fill="#6b4634"/><circle cx="24" cy="-14" r="25" fill="#ab7955"/><circle cx="0" cy="24" r="26" fill="#e4cdae"/><path d="M-39 -22Q-20 -38 -13 -18M10 -22Q29 -36 41 -12" stroke="#d0ae89" stroke-width="4" fill="none"/>',
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280"><defs><radialGradient id="bg"><stop stop-color="${backgrounds[kind % 4]}"/><stop offset="1" stop-color="#b6b4a3"/></radialGradient><filter id="s"><feDropShadow dx="3" dy="8" stdDeviation="7" flood-opacity=".16"/></filter></defs><rect width="400" height="280" fill="url(#bg)"/><path d="M300 0L400 180V0Z" fill="#ede7db" opacity=".4"/><g transform="translate(196 143)" filter="url(#s)"><circle r="115" fill="#f7f3e8"/><circle r="101" fill="#e9e6dc" stroke="#d8d4c8" stroke-width="2"/>${foods[kind % foods.length]}</g><g stroke="#71825a" stroke-width="3" fill="none" opacity=".6"><path d="M335 243L369 181M345 225L361 225M351 214L347 199M362 195L376 193"/></g></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
export const initialCategories = () =>
  ["Main Course", "Snacks", "Drinks", "Desserts"].map((name) => ({
    id: uid(),
    name,
  }));
export function initialMenu(categories: Data["categories"]) {
  const names = [
    [
      "Herb-roasted salmon",
      2450,
      890,
      0,
      "Atlantic salmon, seasonal greens and lemon beurre blanc.",
    ],
    [
      "Tomato & basil pasta",
      1650,
      420,
      0,
      "Fresh pasta with slow-roasted tomatoes and fragrant basil.",
    ],
    [
      "Maison garden salad",
      1250,
      310,
      0,
      "Crisp leaves, heirloom tomatoes and house vinaigrette.",
    ],
    [
      "Wild mushroom risotto",
      1950,
      540,
      0,
      "Creamy arborio rice, woodland mushrooms and parmesan.",
    ],
    [
      "Grilled steak frites",
      2950,
      1200,
      0,
      "Grilled steak with golden fries and herb butter.",
    ],
    [
      "Margherita flatbread",
      1450,
      390,
      1,
      "Stone-baked flatbread with mozzarella, tomato and basil.",
    ],
    [
      "Truffle parmesan fries",
      750,
      180,
      1,
      "Golden fries, shaved parmesan and a touch of truffle.",
    ],
    [
      "Tomato bruschetta",
      850,
      210,
      1,
      "Toasted sourdough, ripe tomatoes and extra virgin olive oil.",
    ],
    [
      "Oat milk cappuccino",
      550,
      120,
      2,
      "Double espresso with silky steamed oat milk.",
    ],
    [
      "House espresso",
      350,
      65,
      2,
      "Our signature roasted coffee, served short.",
    ],
    [
      "Fresh mint lemonade",
      650,
      140,
      2,
      "Fresh lemon, garden mint and a little sparkle.",
    ],
    [
      "Classic tiramisu",
      950,
      280,
      3,
      "Coffee-soaked layers, mascarpone and cocoa.",
    ],
    [
      "Lemon berry tart",
      850,
      240,
      3,
      "Buttery pastry with bright lemon cream and seasonal berries.",
    ],
    [
      "Chocolate gelato",
      650,
      160,
      3,
      "Rich chocolate gelato, made in small batches.",
    ],
  ];
  return names.map((n, index) => ({
    id: uid(),
    name: String(n[0]),
    categoryId: categories[Number(n[3])].id,
    priceCents: Number(n[1]),
    costCents: Number(n[2]),
    description: String(n[4]),
    image: foodArt(index),
    available: true,
    archived: false,
  }));
}
export function makeReceipt(
  s: Omit<Sale, "receipt">,
  settings: Settings,
  demo: boolean,
): Receipt {
  const { currency, payments, ...restaurant } = settings;
  void payments;
  return {
    token: uid(),
    number: s.number,
    createdAt: s.createdAt,
    currency,
    restaurant,
    items: s.items.map(({ name, priceCents, quantity, notes }) => ({
      name,
      priceCents,
      quantity,
      notes,
    })),
    customerName: s.customer.name,
    table: s.customer.table,
    notes: s.customer.notes ? [s.customer.notes].join("") : "",
    paymentMethod: s.paymentMethod,
    receivedCents: s.receivedCents,
    changeCents: s.changeCents,
    subtotalCents: s.subtotalCents,
    discountCents: s.discountCents,
    serviceCents: s.serviceCents,
    taxCents: s.taxCents,
    totalCents: s.totalCents,
    revenueCents: s.revenueCents,
    demo,
  };
}
export function seedData(): Data {
  const categories = initialCategories(),
    products = initialMenu(categories),
    settings = {
      ...DEFAULT_SETTINGS,
      payments: [...DEFAULT_SETTINGS.payments],
    },
    data: Data = {
      settings,
      categories,
      products,
      transactions: [],
      income: [],
      expenses: [],
    };
  for (let day = 13; day >= 0; day--) {
    const count = day === 0 ? 5 : 3 + (day % 4);
    for (let i = 0; i < count; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - day);
      dt.setHours(11 + i * 2, 12 + ((i * 7) % 45), 0, 0);
      const chosen = [
          products[(day + i * 3) % 8],
          products[8 + ((day + i) % 6)],
        ],
        items: Item[] = chosen.map((p) => ({
          productId: p.id,
          name: p.name,
          category: categories.find((c) => c.id === p.categoryId)!.name,
          priceCents: p.priceCents,
          costCents: p.costCents,
          quantity: i % 3 === 0 ? 2 : 1,
          notes: "",
        }));
      const totals = calculate(items, settings, "amount", 0),
        method = settings.payments[i % 4],
        sale: Omit<Sale, "receipt"> = {
          id: uid(),
          requestId: uid(),
          number: `INV-${dateKey(dt, settings.timeZone).replaceAll("-", "")}-${String(i + 1).padStart(4, "0")}`,
          createdAt: dt.toISOString(),
          businessDate: dateKey(dt, settings.timeZone),
          currency: settings.currency,
          customer: {
            name: ["Emma Wilson", "Walk-in", "James Miller", "Sofia Chen", ""][
              i % 5
            ],
            phone: "",
            email: "",
            table: String(i + 1),
            notes: "",
          },
          items,
          paymentMethod: method,
          receivedCents:
            method === "Cash"
              ? Math.ceil(totals.totalCents / 1000) * 1000
              : totals.totalCents,
          changeCents:
            method === "Cash"
              ? Math.ceil(totals.totalCents / 1000) * 1000 - totals.totalCents
              : 0,
          status: "Completed",
          ...totals,
        };
      const transaction = {
        ...sale,
        receipt: makeReceipt(sale, settings, true),
      };
      data.transactions.push(transaction);
      data.income.push({
        id: uid(),
        title: `Sale ${sale.number}`,
        amountCents: sale.revenueCents,
        date: dateKey(dt, settings.timeZone),
        paymentMethod: method,
        description: "Automatically recorded from POS. Sales tax is excluded.",
        source: "POS SALE",
        transactionId: sale.id,
        currency: settings.currency,
      });
    }
  }
  [
    ["Fresh market produce", "Ingredients", 4820, 0],
    ["Coffee beans restock", "Ingredients", 3200, 0],
    ["Electricity bill", "Utilities", 12500, 3],
    ["Kitchen supplies", "Equipment", 6750, 5],
    ["Weekly produce delivery", "Ingredients", 14850, 8],
    ["Local newsletter placement", "Marketing", 4500, 10],
  ].forEach(([title, category, amount, days]) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - Number(days));
    data.expenses.push({
      id: uid(),
      title: String(title),
      category: String(category),
      amountCents: Number(amount),
      date: dateKey(dt, settings.timeZone),
      paymentMethod: "Bank Transfer",
      description: "Sample record — Demo Mode",
      image: "",
      currency: settings.currency,
    });
  });
  return data;
}
