import { useState } from "react";
import {
  ArrowUpRight,
  ShoppingBag,
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowRight,
  Download,
  Info,
} from "lucide-react";
import { aggregate, dateKey, money } from "./domain";
import {
  Bars,
  csvDownload,
  DateFilter,
  makeRange,
  Trend,
  type Range,
} from "./ui";
import { TransactionTable } from "./Management";
import type { Data, Sale } from "./types";
function pointsFor(data: Data, range: Range, group = "Daily") {
  const a = aggregate(data, range.start, range.end),
    map = new Map<string, { label: string; income: number; expense: number }>();
  const get = (value: string) => {
    const day =
      value.length === 10
        ? value
        : dateKey(new Date(value), data.settings.timeZone);
    const d = new Date(day + "T12:00:00");
    if (group === "Weekly") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (group === "Monthly") d.setDate(1);
    const key = dateKey(d),
      label =
        group === "Monthly"
          ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!map.has(key)) map.set(key, { label, income: 0, expense: 0 });
    return map.get(key)!;
  };
  // Include gaps so a quiet day has a visible zero, rather than disappearing.
  const start = new Date(range.start + "T12:00:00"),
    end = new Date(range.end + "T12:00:00");
  const maxDays = 3660;
  for (
    let i = 0, d = new Date(start);
    d <= end && i < maxDays;
    i++, d.setDate(d.getDate() + 1)
  )
    get(dateKey(d));
  a.sales.forEach(
    (s) => (get(s.businessDate || s.createdAt).income += s.revenueCents),
  );
  a.income
    .filter((i) => i.source === "MANUAL INCOME")
    .forEach((i) => (get(i.date).income += i.amountCents));
  a.expenses.forEach((e) => (get(e.date).expense += e.amountCents));
  let points = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, p]) => p);
  if (points.length === 1)
    points = [{ label: "Start", income: 0, expense: 0 }, ...points];
  return points;
}
export function Overview({
  data,
  onReceipt,
  navigate,
  report = false,
}: {
  data: Data;
  onReceipt: (sale: Sale) => void;
  navigate: (page: string) => void;
  report?: boolean;
}) {
  const [range, setRange] = useState(
      makeRange(report ? "This Month" : "Today", data.settings.timeZone),
    ),
    [group, setGroup] = useState("Daily"),
    a = aggregate(data, range.start, range.end),
    currency = data.settings.currency,
    m = (v: number) => money(v, currency);
  const chartRange =
    range.preset === "Today"
      ? (() => {
          const d = new Date(range.end + "T12:00:00");
          d.setDate(d.getDate() - 6);
          return { ...range, start: dateKey(d) };
        })()
      : range;
  const metrics = report
    ? [
        {
          label: "Gross revenue",
          value: a.gross,
          note: "Sales revenue + manual income",
          icon: Wallet,
        },
        {
          label: "Recorded expenses",
          value: a.spending,
          note: "Operating costs in this period",
          icon: ArrowDownLeft,
        },
        {
          label: "Estimated net result",
          value: a.net,
          note: "Revenue minus recorded expenses",
          icon: TrendingUp,
        },
        {
          label: "Average order value",
          value: a.average,
          note: `${a.count} completed transactions`,
          icon: ShoppingBag,
        },
      ]
    : [
        {
          label: "Sales revenue",
          value: a.saleRevenue,
          note: `${a.count} completed transactions`,
          icon: ShoppingBag,
        },
        {
          label: "Total income",
          value: a.gross,
          note: "POS revenue + manual income",
          icon: Wallet,
        },
        {
          label: "Recorded expenses",
          value: a.spending,
          note: `${a.expenses.length} expense records`,
          icon: ArrowDownLeft,
        },
        {
          label: "Estimated net result",
          value: a.net,
          note: "Income minus recorded expenses",
          icon: TrendingUp,
        },
      ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {report
              ? "A CLEARER VIEW OF YOUR BUSINESS"
              : "YOUR RESTAURANT, AT A GLANCE"}
          </span>
          <h1>{report ? "Financial reports" : "A good day, at a glance."}</h1>
          <p>
            {report
              ? "The numbers behind every service, without the guesswork."
              : `Welcome back. Here’s how things are shaping up at ${data.settings.name}.`}
          </p>
        </div>
        <DateFilter
          value={range}
          onChange={setRange}
          timeZone={data.settings.timeZone}
        />
      </div>
      <div className="metric-grid">
        {metrics.map(({ label, value, note, icon: Icon }, i) => (
          <div
            className={"metric-card " + (i === 3 ? "highlight" : "")}
            key={label}
          >
            <div>
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={18} />
              </span>
            </div>
            <strong data-testid={label.toLowerCase().replaceAll(" ", "-")}>
              {m(value)}
            </strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel sales-chart">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE BIG PICTURE</span>
              <h2>{report ? "Revenue over time" : "Sales & spending trend"}</h2>
            </div>
            {report ? (
              <select
                aria-label="Revenue grouping"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                {["Daily", "Weekly", "Monthly"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            ) : (
              <span className="muted">
                {range.preset === "Today" ? "Last 7 days" : range.preset}
              </span>
            )}
          </div>
          <div className="chart-summary">
            <strong>
              {m(aggregate(data, chartRange.start, chartRange.end).gross)}
            </strong>
            <span>revenue · {currency}</span>
          </div>
          <Trend
            points={pointsFor(data, chartRange, group)}
            currency={currency}
          />
        </section>
        <section className="panel daily-balance">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">INCOME VS EXPENSES</span>
              <h2>A balanced perspective</h2>
            </div>
            <Info size={17} className="muted" />
          </div>
          <div
            className="balance-ring"
            style={{
              background: `conic-gradient(var(--accent) 0 ${(a.gross / (a.gross + a.spending || 1)) * 100}%,var(--bronze) ${(a.gross / (a.gross + a.spending || 1)) * 100}% 100%)`,
            }}
          >
            <div>
              <span>Net result</span>
              <strong>{m(a.net)}</strong>
            </div>
          </div>
          <div className="balance-legend">
            <div>
              <span>
                <i />
                Income
              </span>
              <strong>{m(a.gross)}</strong>
            </div>
            <div>
              <span>
                <i className="bronze" />
                Expenses
              </span>
              <strong>{m(a.spending)}</strong>
            </div>
          </div>
        </section>
      </div>
      {report ? (
        <>
          <div className="report-note">
            <Info size={18} />
            <span>
              Revenue excludes collected sales tax ({m(a.tax)}). Customer
              payments total {m(a.takings)}. Estimated net result is revenue
              less recorded expenses; product costs are shown separately below.
            </span>
            <button
              className="button secondary"
              onClick={() =>
                csvDownload("financial-report.csv", [
                  ["Metric", "Value", "Currency", "Start", "End"],
                  ...[
                    "Gross revenue",
                    "Sales revenue",
                    "Manual income",
                    "Expenses",
                    "Estimated net result",
                    "Sales tax collected",
                    "Customer payments",
                    "Transactions",
                    "Average order",
                  ].map((name, index) => [
                    name,
                    index === 7
                      ? a.count
                      : (
                          [
                            a.gross,
                            a.saleRevenue,
                            a.manual,
                            a.spending,
                            a.net,
                            a.tax,
                            a.takings,
                            0,
                            a.average,
                          ][index] / 100
                        ).toFixed(2),
                    currency,
                    range.start,
                    range.end,
                  ]),
                ])
              }
            >
              <Download size={15} />
              Export report
            </button>
          </div>
          <div className="report-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Revenue by product</h2>
                <span className="muted">After discount</span>
              </div>
              <Bars items={a.products} currency={currency} />
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Revenue by category</h2>
              </div>
              <Bars items={a.categories} currency={currency} />
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Payments by method</h2>
                <span className="muted">Includes tax</span>
              </div>
              <Bars items={a.payments} currency={currency} />
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Expenses by category</h2>
              </div>
              <Bars items={a.expenseCategories} currency={currency} />
            </section>
          </div>
          <section className="panel cost-report">
            <div>
              <h2>Product costs & gross profit</h2>
              <p>
                Calculated from recorded item costs. These costs are separate
                from operating expenses above.
              </p>
            </div>
            {a.costKnown ? (
              <div className="cost-metrics">
                <div>
                  <span>Cost of goods sold</span>
                  <strong>{m(a.cogs)}</strong>
                </div>
                <div>
                  <span>Sales gross profit</span>
                  <strong>{m(a.grossProfit)}</strong>
                </div>
                <div>
                  <span>Sales gross margin</span>
                  <strong>
                    {a.saleRevenue
                      ? ((a.grossProfit / a.saleRevenue) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </strong>
                </div>
              </div>
            ) : (
              <p className="payment-notice">
                Some sold items have no recorded cost. Complete cost prices for
                future orders to calculate a full gross profit report.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="overview-bottom">
            <section className="panel best-sellers">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">GUEST FAVORITES</span>
                  <h2>Best-selling dishes</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("Products")}
                >
                  View menu
                  <ArrowUpRight size={15} />
                </button>
              </div>
              {a.productQty.length ? (
                a.productQty.slice(0, 4).map((p, i) => {
                  const product = data.products.find((v) => v.name === p.name);
                  return (
                    <div className="best-seller" key={p.name}>
                      <span className="rank">0{i + 1}</span>
                      {product && <img src={product.image} alt="" />}
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {data.categories.find(
                            (c) => c.id === product?.categoryId,
                          )?.name || "Menu item"}
                        </small>
                      </div>
                      <span>
                        {p.amount}
                        <small>sold</small>
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="muted">
                  Record a sale to see your guest favorites.
                </p>
              )}
            </section>
            <section className="service-banner">
              <span className="eyebrow">
                A LITTLE LESS ADMIN.
                <br />A LITTLE MORE HOSPITALITY.
              </span>
              <h2>
                Ready for the
                <br />
                next great service?
              </h2>
              <p>
                Your menu is set.
                <br />
                Let’s make someone’s day.
              </p>
              <button
                className="button light"
                onClick={() => navigate("Point of Sale")}
              >
                Open Point of Sale
                <ArrowRight size={18} />
              </button>
              <div className="banner-decoration">◒</div>
            </section>
          </div>
          <section className="panel recent-transactions">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">THE LATEST ORDERS</span>
                <h2>Recent transactions</h2>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("Transactions")}
              >
                View all transactions
                <ArrowUpRight size={16} />
              </button>
            </div>
            <TransactionTable
              rows={[...a.sales]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 5)}
              onReceipt={onReceipt}
            />
            {!a.sales.length && (
              <p className="muted no-records">
                No sales in this period. Your next order will appear here.
              </p>
            )}
          </section>
          <div className="dashboard-footnote">
            <span>
              Average order value <strong>{m(a.average)}</strong>
            </span>
            <span>
              Revenue excludes sales tax. Estimated net result uses recorded
              expenses.
            </span>
          </div>
        </>
      )}
    </>
  );
}
