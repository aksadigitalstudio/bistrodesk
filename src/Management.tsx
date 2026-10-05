import { useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FolderOpen,
  ArrowUpRight,
  ReceiptText,
  Download,
} from "lucide-react";
import { CONFIG, EXPENSE_CATEGORIES } from "./config";
import {
  cents,
  dateKey,
  money,
  niceDate,
  niceTime,
  today,
  uid,
  validateSettings,
} from "./domain";
import {
  csvDownload,
  Empty,
  errorText,
  Field,
  Media,
  Modal,
  UploadField,
} from "./ui";
import type {
  Category,
  Collection,
  Data,
  Expense,
  Income,
  Product,
  Repository,
  Sale,
  Settings,
} from "./types";
export type ManagementProps = {
  data: Data;
  repo: Repository;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
};
export function Products({ data, repo, refresh, notify }: ManagementProps) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [availability, setAvailability] = useState("all"),
    [editing, setEditing] = useState<Product | null>(null),
    [categories, setCategories] = useState(false),
    [name, setName] = useState(""),
    [categoryEdit, setCategoryEdit] = useState<Category | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [archive, setArchive] = useState<Product | null>(null);
  const [price, setPrice] = useState(""),
    [cost, setCost] = useState("");
  const start = (p?: Product) => {
    const value = p || {
      id: uid(),
      name: "",
      categoryId: data.categories[0]?.id || "",
      priceCents: 0,
      costCents: null,
      description: "",
      image: "",
      available: true,
      archived: false,
    };
    setEditing({ ...value });
    setPrice(p ? (p.priceCents / 100).toFixed(2) : "");
    setCost(p?.costCents != null ? (p.costCents / 100).toFixed(2) : "");
    setError("");
  };
  const save = async () => {
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    try {
      await repo.save("products", {
        ...editing,
        name: editing.name.trim(),
        priceCents: cents(price),
        costCents: cost === "" ? null : cents(cost),
      });
      await refresh();
      setEditing(null);
      notify("Product saved to your menu.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const rows = data.products.filter(
    (p) =>
      !p.archived &&
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || p.categoryId === filter) &&
      (availability === "all" ||
        p.available === (availability === "available")),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CURATE YOUR MENU</span>
          <h1>Products</h1>
          <p>Thoughtfully made dishes, beautifully organized.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={() => {
              setCategories(true);
              setError("");
            }}
          >
            <FolderOpen size={16} />
            Categories
          </button>
          <button className="button primary" onClick={() => start()}>
            <Plus size={17} />
            Add product
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search products"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Product category filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Product availability filter"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="all">Any availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <span className="muted">{rows.length} products</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>SELLING PRICE</th>
                <th>COST</th>
                <th>AVAILABILITY</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <Media src={p.image} alt={p.name} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.description}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {data.categories.find((c) => c.id === p.categoryId)?.name}
                  </td>
                  <td className="amount">
                    {money(p.priceCents, data.settings.currency)}
                  </td>
                  <td>
                    {p.costCents === null
                      ? "—"
                      : money(p.costCents, data.settings.currency)}
                  </td>
                  <td>
                    <button
                      className={"status-button " + (p.available ? "" : "off")}
                      onClick={async () => {
                        try {
                          await repo.save("products", {
                            ...p,
                            available: !p.available,
                          });
                          await refresh();
                          notify(
                            p.available
                              ? "Product marked unavailable."
                              : "Product available for orders.",
                          );
                        } catch (e) {
                          notify(errorText(e));
                        }
                      }}
                    >
                      {p.available ? "Available" : "Unavailable"}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        aria-label={"Edit " + p.name}
                        onClick={() => start(p)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={"Archive " + p.name}
                        onClick={() => {
                          setArchive(p);
                          setError("");
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="Your menu is waiting"
            body="Add your first product, or change the filters."
          />
        )}
      </div>
      {editing && (
        <Modal
          title={
            data.products.some((p) => p.id === editing.id)
              ? "Edit product"
              : "Add a new product"
          }
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <UploadField
              repo={repo}
              value={editing.image}
              onChange={(image) => setEditing({ ...editing, image })}
              onError={setError}
              onBusy={setBusy}
              label="Product photo"
            />
            <div className="form-grid">
              <Field label="Product name">
                <input
                  required
                  maxLength={120}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Category">
                <select
                  required
                  value={editing.categoryId}
                  onChange={(e) =>
                    setEditing({ ...editing, categoryId: e.target.value })
                  }
                >
                  <option value="">Choose category</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={"Selling price (" + data.settings.currency + ")"}>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
              <Field
                label={"Cost price (" + data.settings.currency + ")"}
                help="Optional. Used for cost and gross profit reports."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                maxLength={1000}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={editing.available}
                onChange={(e) =>
                  setEditing({ ...editing, available: e.target.checked })
                }
              />
              Available for orders
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-footer">
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save product"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {archive && (
        <Modal title="Archive this product?" onClose={() => setArchive(null)}>
          <p>
            “{archive.name}” will be removed from the active menu. Its past
            transactions will be preserved.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setArchive(null)}
            >
              Cancel
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repo.save("products", {
                    ...archive,
                    archived: true,
                    available: false,
                  });
                  await refresh();
                  setArchive(null);
                  notify("Product archived.");
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Archive product
            </button>
          </div>
        </Modal>
      )}
      {categories && (
        <Modal title="Menu categories" onClose={() => setCategories(false)}>
          <form
            className="category-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await repo.save("categories", {
                  id: categoryEdit?.id || uid(),
                  name: name.trim(),
                });
                setName("");
                setCategoryEdit(null);
                await refresh();
                notify("Category saved.");
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={categoryEdit ? "Rename category" : "New category"}>
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Seasonal specials"
              />
            </Field>
            <button className="button primary" disabled={busy}>
              {categoryEdit ? "Save" : "Add"}
            </button>
          </form>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="category-list">
            {data.categories.map((c) => (
              <div key={c.id}>
                <span>
                  {c.name}
                  <small>
                    {
                      data.products.filter(
                        (p) => p.categoryId === c.id && !p.archived,
                      ).length
                    }{" "}
                    products
                  </small>
                </span>
                <div>
                  <button
                    className="icon-btn"
                    aria-label={"Rename " + c.name}
                    onClick={() => {
                      setName(c.name);
                      setCategoryEdit(c);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label={"Delete category " + c.name}
                    onClick={async () => {
                      if (!window.confirm(`Delete the category “${c.name}”?`))
                        return;
                      try {
                        await repo.remove("categories", c.id);
                        await refresh();
                      } catch (e) {
                        setError(errorText(e));
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
export function Transactions({
  data,
  onReceipt,
}: {
  data: Data;
  onReceipt: (sale: Sale) => void;
}) {
  const [query, setQuery] = useState(""),
    [date, setDate] = useState(""),
    [payment, setPayment] = useState("all"),
    [min, setMin] = useState(""),
    [max, setMax] = useState("");
  const rows = data.transactions
    .filter(
      (t) =>
        (t.number + " " + t.customer.name)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!date ||
          (t.businessDate ||
            dateKey(new Date(t.createdAt), t.receipt.restaurant.timeZone)) ===
            date) &&
        (payment === "all" || t.paymentMethod === payment) &&
        (!min || t.totalCents >= Number(min) * 100) &&
        (!max || t.totalCents <= Number(max) * 100),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY ORDER, ON RECORD</span>
          <h1>Transactions</h1>
          <p>A clear trail from the first order to the final receipt.</p>
        </div>
        <span className="soft-badge">
          {data.transactions.length} completed sales
        </span>
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search transactions"
              placeholder="Receipt number or customer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <input
            aria-label="Transaction date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <select
            aria-label="Payment filter"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="all">All payment methods</option>
            {data.settings.payments.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input
            className="small-input"
            type="number"
            min="0"
            step=".01"
            aria-label="Minimum total"
            placeholder="Min total"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <input
            className="small-input"
            type="number"
            min="0"
            step=".01"
            aria-label="Maximum total"
            placeholder="Max total"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        <TransactionTable rows={rows} onReceipt={onReceipt} />
        {!rows.length && (
          <Empty
            title="No transactions found"
            body="Try another filter or record a sale from Point of Sale."
          />
        )}
      </div>
    </>
  );
}
export function TransactionTable({
  rows,
  onReceipt,
}: {
  rows: Sale[];
  onReceipt: (s: Sale) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>RECEIPT</th>
            <th>CUSTOMER</th>
            <th>DATE & TIME</th>
            <th>PAYMENT</th>
            <th>TOTAL</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <button className="receipt-link" onClick={() => onReceipt(t)}>
                  {t.number}
                </button>
              </td>
              <td>{t.customer.name || "Walk-in"}</td>
              <td>
                {niceDate(t.createdAt, t.receipt.restaurant.timeZone)}
                <small>
                  {niceTime(t.createdAt, t.receipt.restaurant.timeZone)}
                </small>
              </td>
              <td>{t.paymentMethod}</td>
              <td className="amount">{money(t.totalCents, t.currency)}</td>
              <td>
                <span className="status-pill">Completed</span>
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={"Open receipt " + t.number}
                  onClick={() => onReceipt(t)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Ledger({
  type,
  data,
  repo,
  refresh,
  notify,
}: ManagementProps & { type: "income" | "expenses" }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [date, setDate] = useState(""),
    [edit, setEdit] = useState<Income | Expense | null>(null),
    [amount, setAmount] = useState(""),
    [deleting, setDeleting] = useState<Income | Expense | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const isExpense = type === "expenses",
    title = isExpense ? "Expenses" : "Income",
    currency = data.settings.currency;
  const start = (record?: Income | Expense) => {
    setEdit(
      record
        ? { ...record }
        : isExpense
          ? {
              id: uid(),
              title: "",
              category: EXPENSE_CATEGORIES[0],
              amountCents: 0,
              date: today(data.settings.timeZone),
              paymentMethod: data.settings.payments[0],
              description: "",
              image: "",
              currency,
            }
          : {
              id: uid(),
              title: "",
              amountCents: 0,
              date: today(data.settings.timeZone),
              paymentMethod: data.settings.payments[0],
              description: "",
              source: "MANUAL INCOME",
              transactionId: null,
              currency,
            },
    );
    setAmount(record ? (record.amountCents / 100).toFixed(2) : "");
    setError("");
  };
  const rows = (data[type] as (Income | Expense)[])
    .filter(
      (r) =>
        (r.title + " " + r.description)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!date || r.date === date) &&
        (filter === "all" ||
          (isExpense
            ? (r as Expense).category === filter
            : (r as Income).source === filter)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {isExpense ? "KEEP COSTS IN VIEW" : "KNOW WHAT COMES IN"}
          </span>
          <h1>{title}</h1>
          <p>
            {isExpense
              ? "From fresh ingredients to the essentials behind every service."
              : "POS sales are recorded automatically. Add other revenue here."}
          </p>
        </div>
        <button className="button primary" onClick={() => start()}>
          <Plus size={17} />
          {isExpense ? "Add expense" : "Add manual income"}
        </button>
      </div>
      <div className="ledger-summary">
        <div>
          <span>
            {title} in view · {currency}
          </span>
          <strong data-testid="ledger-total">
            {money(
              rows
                .filter((r) => r.currency === currency)
                .reduce((s, r) => s + r.amountCents, 0),
              currency,
            )}
          </strong>
        </div>
        <span>
          {rows.length} records
          {!isExpense && <small>Sales tax excluded from POS income.</small>}
        </span>
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label={"Search " + type}
              placeholder={"Search " + type + "…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label={"Filter " + type}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">
              {isExpense ? "All categories" : "All income sources"}
            </option>
            {(isExpense
              ? EXPENSE_CATEGORIES
              : ["POS SALE", "MANUAL INCOME"]
            ).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="date"
            aria-label={title + " date filter"}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="button secondary"
            onClick={() =>
              csvDownload(type + ".csv", [
                [
                  "Title",
                  "Date",
                  "Source / category",
                  "Amount",
                  "Currency",
                  "Payment method",
                ],
                ...rows.map((r) => [
                  r.title,
                  r.date,
                  isExpense ? (r as Expense).category : (r as Income).source,
                  (r.amountCents / 100).toFixed(2),
                  r.currency,
                  r.paymentMethod,
                ]),
              ])
            }
          >
            <Download size={16} />
            Export
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{isExpense ? "EXPENSE" : "INCOME"}</th>
                <th>{isExpense ? "CATEGORY" : "SOURCE"}</th>
                <th>DATE</th>
                <th>PAYMENT</th>
                <th>AMOUNT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    {r.description && (
                      <small className="description-cell">
                        {r.description}
                      </small>
                    )}
                  </td>
                  <td>
                    <span
                      className={"status-pill " + (isExpense ? "neutral" : "")}
                    >
                      {isExpense
                        ? (r as Expense).category
                        : (r as Income).source}
                    </span>
                  </td>
                  <td>{niceDate(r.date)}</td>
                  <td>{r.paymentMethod}</td>
                  <td className="amount">{money(r.amountCents, r.currency)}</td>
                  <td>
                    {isExpense || (r as Income).source === "MANUAL INCOME" ? (
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          aria-label={"Edit " + r.title}
                          onClick={() => start(r)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn danger"
                          aria-label={"Delete " + r.title}
                          onClick={() => {
                            setDeleting(r);
                            setError("");
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="linked-sale">
                        <ReceiptText size={15} />
                        Linked sale
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title={"No " + type + " found"}
            body="Add a record or adjust your filters."
          />
        )}
      </div>
      {edit && (
        <Modal
          title={
            (data[type].some((r) => r.id === edit.id) ? "Edit " : "Add ") +
            (isExpense ? "expense" : "manual income")
          }
          onClose={() => {
            if (!busy) setEdit(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setError("");
              setBusy(true);
              try {
                await repo.save(type as Collection, {
                  ...edit,
                  title: edit.title.trim(),
                  amountCents: cents(amount),
                });
                await refresh();
                setEdit(null);
                notify(title + " record saved.");
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Title">
                <input
                  required
                  maxLength={150}
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
              {isExpense && (
                <Field label="Expense category">
                  <select
                    value={(edit as Expense).category}
                    onChange={(e) =>
                      setEdit({ ...edit, category: e.target.value } as Expense)
                    }
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={"Amount (" + edit.currency + ")"}>
                <input
                  required
                  type="number"
                  min=".01"
                  step=".01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Date">
                <input
                  required
                  type="date"
                  value={edit.date}
                  onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                />
              </Field>
              <Field label="Payment method">
                <select
                  value={edit.paymentMethod}
                  onChange={(e) =>
                    setEdit({ ...edit, paymentMethod: e.target.value })
                  }
                >
                  {data.settings.payments.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={edit.description}
                maxLength={2000}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </Field>
            {isExpense && (
              <UploadField
                repo={repo}
                privateFile
                label="Expense receipt"
                value={(edit as Expense).image}
                onChange={(image) => setEdit({ ...edit, image } as Expense)}
                onError={setError}
                onBusy={setBusy}
              />
            )}
            <p className="form-hint">
              {isExpense
                ? "Recorded expenses are deducted from revenue to estimate your net result."
                : "Use this for revenue outside POS. A completed POS sale already has one income record."}
            </p>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : "Save " + (isExpense ? "expense" : "income")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={"Delete this " + (isExpense ? "expense" : "income") + "?"}
          onClose={() => setDeleting(null)}
        >
          <p>
            “{deleting.title}” will be permanently removed from your records and
            reports.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repo.remove(type, deleting.id);
                  await refresh();
                  setDeleting(null);
                  notify("Record deleted.");
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete record
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function SettingsPage({ data, repo, refresh, notify }: ManagementProps) {
  const [form, setForm] = useState<Settings>({ ...data.settings }),
    [payments, setPayments] = useState(data.settings.payments.join("\n")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOUR OWN</span>
          <h1>Restaurant settings</h1>
          <p>Your identity, your pricing rules, your finishing touches.</p>
        </div>
        <span className="soft-badge">
          {CONFIG.appName} ·{" "}
          {repo.mode === "demo" ? "Demo Mode" : "Cloud workspace"}
        </span>
      </div>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          setBusy(true);
          try {
            const settings = {
              ...form,
              name: form.name.trim(),
              currency: form.currency.trim().toUpperCase(),
              payments: payments
                .split("\n")
                .map((p) => p.trim())
                .filter(Boolean),
            };
            validateSettings(settings);
            await repo.settings(settings);
            await refresh();
            notify(
              "Settings saved. Future orders and receipts will use these details.",
            );
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="panel settings-panel">
          <div>
            <h2>Restaurant identity</h2>
            <p>These details appear on customer receipts.</p>
          </div>
          <UploadField
            repo={repo}
            value={form.logo}
            label="Restaurant logo"
            onChange={(logo) => setForm({ ...form, logo })}
            onError={setError}
            onBusy={setBusy}
          />
          <div className="form-grid">
            <Field label="Restaurant name">
              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Address">
              <input
                maxLength={250}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                maxLength={40}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                maxLength={150}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Receipt footer">
            <textarea
              maxLength={500}
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
            />
          </Field>
        </section>
        <section className="panel settings-panel">
          <h2>Pricing & payment</h2>
          <Field
            label="Restaurant time zone"
            help="Used for daily reports, invoice dates and receipt times."
          >
            <select
              value={
                form.timeZone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
              onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
            >
              {[
                ...new Set([
                  "UTC",
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                  ...Intl.supportedValuesOf("timeZone"),
                ]),
              ].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </Field>
          <p>
            Applied automatically at checkout. Existing receipts preserve their
            original settings.
          </p>
          <div className="form-grid three">
            <Field
              label="Currency code"
              help="ISO currency code, e.g. USD or EUR."
            >
              <input
                required
                minLength={3}
                maxLength={3}
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Sales tax (%)">
              <input
                required
                type="number"
                min="0"
                max="100"
                step=".01"
                value={form.taxRate}
                onChange={(e) =>
                  setForm({ ...form, taxRate: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Service charge (%)">
              <input
                required
                type="number"
                min="0"
                max="100"
                step=".01"
                value={form.serviceRate}
                onChange={(e) =>
                  setForm({ ...form, serviceRate: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <p className="payment-notice">
            Changing currency does not convert existing amounts. Historical
            records retain their currency; dashboards and reports use the
            currently selected currency.
          </p>
          <Field
            label="Payment methods"
            help="One method per line. Keep “Cash” for amount received and change calculations."
          >
            <textarea
              required
              rows={6}
              value={payments}
              onChange={(e) => setPayments(e.target.value)}
            />
          </Field>
        </section>
        <div className="settings-footer">
          <span>
            {repo.mode === "demo"
              ? "Changes are saved on this browser. Configure Supabase for a private, shared cloud workspace."
              : "Changes are saved to your secure cloud workspace."}
          </span>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
      </form>
    </>
  );
}
