import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  ArrowRight,
  ShoppingBag,
  Check,
  Wallet,
  CreditCard,
  StickyNote,
} from "lucide-react";
import { calculate, cents, money, uid } from "./domain";
import { Empty, errorText, Field, Media, Modal } from "./ui";
import type { CartLine, Customer, Data, Item, Repository, Sale } from "./types";
export function POS({
  data,
  repo,
  onSale,
}: {
  data: Data;
  repo: Repository;
  onSale: (sale: Sale) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [lines, setLines] = useState<CartLine[]>([]),
    [notes, setNotes] = useState(""),
    [discount, setDiscount] = useState("0"),
    [kind, setKind] = useState<"amount" | "percent">("amount"),
    [checkout, setCheckout] = useState(false),
    [showNotes, setShowNotes] = useState(false);
  const [method, setMethod] = useState(data.settings.payments[0]),
    [received, setReceived] = useState(""),
    [customer, setCustomer] = useState<Customer>({
      name: "",
      phone: "",
      email: "",
      table: "",
      notes: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    request = useRef(uid());
  const m = (v: number) => money(v, data.settings.currency),
    products = data.products.filter(
      (p) =>
        !p.archived &&
        (category === "all" || p.categoryId === category) &&
        (p.name + " " + p.description)
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const items: Item[] = useMemo(
    () =>
      lines.map((l) => {
        const p = data.products.find((p) => p.id === l.productId)!;
        return {
          productId: p.id,
          name: p.name,
          category:
            data.categories.find((c) => c.id === p.categoryId)?.name || "",
          priceCents: p.priceCents,
          costCents: p.costCents,
          quantity: l.quantity,
          notes: l.notes,
        };
      }),
    [lines, data],
  );
  let calculationError = "";
  let totals = calculate(items, data.settings, "amount", 0);
  try {
    totals = calculate(
      items,
      data.settings,
      kind,
      kind === "amount" ? cents(discount) : Number(discount),
    );
  } catch (e) {
    calculationError = errorText(e);
  }
  const add = (id: string) => {
    setLines((prev) => {
      const found = prev.find((l) => l.productId === id);
      return found
        ? prev.map((l) =>
            l.productId === id
              ? { ...l, quantity: Math.min(999, l.quantity + 1) }
              : l,
          )
        : [...prev, { productId: id, quantity: 1, notes: "" }];
    });
    setError("");
  };
  const quantity = (id: string, delta: number) =>
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === id
            ? { ...l, quantity: Math.min(999, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  const settle = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const paid = method === "Cash" ? cents(received) : totals.totalCents;
      const sale = await repo.checkout({
        requestId: request.current,
        lines,
        customer,
        orderNotes: notes,
        discountKind: kind,
        discountValue: Number(discount),
        paymentMethod: method,
        receivedCents: paid,
      });
      setLines([]);
      setNotes("");
      setDiscount("0");
      setReceived("");
      setCustomer({ name: "", phone: "", email: "", table: "", notes: "" });
      request.current = uid();
      setCheckout(false);
      await onSale(sale);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE SERVICE COUNTER</span>
          <h1>Point of Sale</h1>
          <p>Good food. Smooth service. Every order in its place.</p>
        </div>
        <span className="soft-badge">
          <span className="dot" />
          Ready for orders
        </span>
      </div>
      <div className="pos-layout">
        <section className="menu-panel">
          <div className="menu-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Search menu"
                placeholder="Search the menu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌕</kbd>
            </div>
            <span className="muted">{products.length} items</span>
          </div>
          <div className="category-tabs">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              All items
            </button>
            {data.categories.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "active" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <button
                className={
                  "product-card " + (!p.available ? "unavailable" : "")
                }
                key={p.id}
                disabled={!p.available}
                onClick={() => add(p.id)}
                aria-label={`Add ${p.name}`}
              >
                <div className="product-photo">
                  <Media src={p.image} alt={p.name} />
                  <span className="add-product">
                    <Plus size={18} />
                  </span>
                  {!p.available && (
                    <span className="sold-out">Unavailable</span>
                  )}
                </div>
                <div className="product-info">
                  <small>
                    {data.categories.find((c) => c.id === p.categoryId)?.name}
                  </small>
                  <h3>{p.name}</h3>
                  <div>
                    <strong>{m(p.priceCents)}</strong>
                    <span>{p.available ? "Available" : "Not available"}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {!products.length && (
            <Empty
              title="No menu items found"
              body="Try another search or add a product from Products."
            />
          )}
        </section>
        <aside className="order-card">
          <div className="order-header">
            <div>
              <span className="eyebrow">CURRENT ORDER</span>
              <h2>A fresh order</h2>
            </div>
            <span className="order-count">
              {lines.reduce((s, l) => s + l.quantity, 0)}
            </span>
          </div>
          <div className="order-table">
            <span>
              <ShoppingBag size={15} />
              Dine-in or takeaway
            </span>
            <label>
              Table
              <input
                aria-label="Table number"
                placeholder="—"
                value={customer.table}
                maxLength={30}
                onChange={(e) =>
                  setCustomer({ ...customer, table: e.target.value })
                }
              />
            </label>
          </div>
          <div className="cart-items">
            {lines.length ? (
              lines.map((line) => {
                const p = data.products.find((p) => p.id === line.productId)!;
                return (
                  <div className="cart-line" key={line.productId}>
                    <Media src={p.image} alt={p.name} />
                    <div className="cart-line-main">
                      <strong>{p.name}</strong>
                      <small>{m(p.priceCents)} each</small>
                      <div className="quantity-control">
                        <button
                          aria-label={`Decrease ${p.name}`}
                          onClick={() => quantity(p.id, -1)}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          aria-label={`Increase ${p.name}`}
                          onClick={() => quantity(p.id, 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <input
                        className="item-note"
                        aria-label={`Notes for ${p.name}`}
                        placeholder="Add item note…"
                        value={line.notes}
                        maxLength={500}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.productId === p.id
                                ? { ...l, notes: e.target.value }
                                : l,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="cart-line-total">
                      <strong>{m(line.quantity * p.priceCents)}</strong>
                      <button
                        className="icon-btn"
                        aria-label={`Remove ${p.name}`}
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.productId !== p.id),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty
                title="Your next great meal"
                body="Choose a menu item to start an order."
              />
            )}
          </div>
          <button
            className="order-note-toggle"
            onClick={() => setShowNotes(!showNotes)}
          >
            <StickyNote size={15} />
            {notes ? "Edit order notes" : "Add order notes"}
            <Plus size={14} />
          </button>
          {showNotes && (
            <textarea
              className="order-notes"
              aria-label="Order notes"
              placeholder="Allergies, special requests, or takeaway…"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
          <div className="discount-control">
            <span>Discount</span>
            <div>
              <select
                aria-label="Discount type"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="amount">{data.settings.currency}</option>
                <option value="percent">%</option>
              </select>
              <input
                aria-label="Discount value"
                type="number"
                min="0"
                max={kind === "percent" ? 100 : undefined}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </div>
          <div className="order-totals">
            <div>
              <span>Subtotal</span>
              <span>{m(totals.subtotalCents)}</span>
            </div>
            {totals.discountCents > 0 && (
              <div>
                <span>Discount</span>
                <span>−{m(totals.discountCents)}</span>
              </div>
            )}
            {data.settings.taxRate > 0 && (
              <div>
                <span>Sales tax ({data.settings.taxRate}%)</span>
                <span>{m(totals.taxCents)}</span>
              </div>
            )}
            {data.settings.serviceRate > 0 && (
              <div>
                <span>Service charge ({data.settings.serviceRate}%)</span>
                <span>{m(totals.serviceCents)}</span>
              </div>
            )}
            <div className="grand-total">
              <strong>Grand total</strong>
              <strong data-testid="cart-total">{m(totals.totalCents)}</strong>
            </div>
          </div>
          {calculationError && (
            <p className="form-error" role="alert">
              {calculationError}
            </p>
          )}
          <button
            className="button primary checkout-button"
            disabled={!lines.length || !!calculationError}
            onClick={() => {
              setMethod(
                data.settings.payments.includes(method)
                  ? method
                  : data.settings.payments[0],
              );
              setError("");
              setCheckout(true);
            }}
          >
            Proceed to checkout
            <ArrowRight size={19} />
          </button>
          <p className="order-footnote">
            Prices in {data.settings.currency} · payment recorded securely
          </p>
        </aside>
      </div>
      {checkout && (
        <Modal
          title="Complete the order"
          onClose={() => {
            if (!busy) setCheckout(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void settle();
            }}
          >
            <div className="checkout-amount">
              <span>Amount to collect</span>
              <strong>{m(totals.totalCents)}</strong>
              <small>
                {items.reduce((s, i) => s + i.quantity, 0)} items ·{" "}
                {customer.table ? "Table " + customer.table : "Walk-in order"}
              </small>
            </div>
            <span className="form-section-label">PAYMENT METHOD</span>
            <div className="payment-options">
              {data.settings.payments.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={method === p ? "selected" : ""}
                  onClick={() => setMethod(p)}
                >
                  {p === "Cash" ? (
                    <Wallet size={17} />
                  ) : (
                    <CreditCard size={17} />
                  )}
                  <span>{p}</span>
                  {method === p && <Check size={14} />}
                </button>
              ))}
            </div>
            {method === "Cash" ? (
              <div className="cash-fields">
                <Field
                  label={"Amount received (" + data.settings.currency + ")"}
                >
                  <input
                    autoComplete="off"
                    aria-label="Amount received"
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    placeholder={(totals.totalCents / 100).toFixed(2)}
                  />
                </Field>
                <div className="cash-change">
                  <span>Change due</span>
                  <strong data-testid="change-due">
                    {m(
                      Math.max(
                        0,
                        (Number(received) || 0) * 100 - totals.totalCents,
                      ),
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="payment-notice">
                Confirm payment with your provider or card terminal before
                recording this sale.
              </p>
            )}
            <details className="customer-details">
              <summary>
                Customer details <span>Optional</span>
              </summary>
              <div className="form-grid">
                <Field label="Customer name">
                  <input
                    value={customer.name}
                    maxLength={100}
                    onChange={(e) =>
                      setCustomer({ ...customer, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Phone / WhatsApp">
                  <input
                    type="tel"
                    placeholder="Include country code"
                    value={customer.phone}
                    maxLength={40}
                    onChange={(e) =>
                      setCustomer({ ...customer, phone: e.target.value })
                    }
                  />
                </Field>
                <Field label="Customer email">
                  <input
                    type="email"
                    value={customer.email}
                    maxLength={150}
                    onChange={(e) =>
                      setCustomer({ ...customer, email: e.target.value })
                    }
                  />
                </Field>
                <Field label="Table">
                  <input
                    value={customer.table}
                    maxLength={30}
                    onChange={(e) =>
                      setCustomer({ ...customer, table: e.target.value })
                    }
                  />
                </Field>
              </div>
            </details>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-footer">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setCheckout(false)}
              >
                Back to order
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving sale…" : "Record payment"}
                <ArrowRight size={17} />
              </button>
            </div>
            <p className="form-hint">
              {repo.mode === "demo"
                ? "Demo sale · saved on this browser."
                : "The transaction, items and sales income are saved together."}
            </p>
          </form>
        </Modal>
      )}
    </>
  );
}
