import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  ReceiptText,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Settings,
  ChevronRight,
  Leaf,
  Menu,
  X,
  LogOut,
  Check,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { CONFIG, DEFAULT_SETTINGS } from "./config";
import { Brand, errorText, Field, Modal } from "./ui";
import {
  check,
  cloud,
  cloudRepository,
  demoRepository,
  supabase,
} from "./store";
import { initialCategories, initialMenu } from "./seed";
import { POS } from "./POS";
import { Ledger, Products, SettingsPage, Transactions } from "./Management";
import { Overview } from "./Overview";
import { PublicReceipt, ReceiptView } from "./Receipt";
import type { Data, Repository, Sale } from "./types";
const NAV = [
  ["Dashboard", LayoutDashboard],
  ["Point of Sale", ShoppingBag],
  ["Products", UtensilsCrossed],
  ["Transactions", ReceiptText],
  ["Income", ArrowDownLeft],
  ["Expenses", ArrowUpRight],
  ["Reports", BarChart3],
  ["Settings", Settings],
] as const;
export function App() {
  const receipt = location.pathname.match(/^\/receipt\/([^/]+)\/?$/);
  return receipt ? <PublicReceipt token={receipt[1]} /> : <Workspace />;
}
function Workspace() {
  const [repo, setRepo] = useState<Repository | null>(
      cloud ? null : demoRepository,
    ),
    [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState("Dashboard"),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [authReady, setAuthReady] = useState(!cloud),
    [user, setUser] = useState(""),
    [needsSetup, setNeedsSetup] = useState(false);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const resolve = async () => {
      try {
        const session = check(await supabase!.auth.getSession()).session;
        if (!active) return;
        setUser(session?.user.email || "");
        if (!session) {
          setRepo(null);
          setData(null);
          setNeedsSetup(false);
          return;
        }
        const members = check(
          await supabase!
            .from("restaurant_members")
            .select("restaurant_id")
            .eq("user_id", session.user.id),
        );
        if (!active) return;
        if (members?.length) {
          setRepo(cloudRepository(members[0].restaurant_id));
          setNeedsSetup(false);
        } else {
          setRepo(null);
          setNeedsSetup(true);
        }
      } catch (e) {
        if (active) setError(errorText(e));
      } finally {
        if (active) setAuthReady(true);
      }
    };
    void resolve();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) void resolve();
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    if (repo) {
      const loaded = await repo.load();
      setData(loaded);
      setError("");
    }
  }, [repo]);
  useEffect(() => {
    void refresh().catch((e) => setError(errorText(e)));
  }, [refresh]);
  const navigate = (target: string) => {
    setPage(target);
    setMobile(false);
    window.scrollTo({ top: 0 });
  };
  if (!authReady)
    return (
      <div className="startup">
        <Brand />
        <p>Opening your workspace…</p>
      </div>
    );
  if (cloud && !repo)
    return (
      <CloudWelcome
        needsSetup={needsSetup}
        user={user}
        error={error}
        onSetup={(id) => setRepo(cloudRepository(id))}
      />
    );
  if (!data)
    return (
      <div className="startup">
        <Brand />
        <p>{error || "Preparing your restaurant workspace…"}</p>
        {error && (
          <button
            className="button primary"
            onClick={() => void refresh().catch((e) => setError(errorText(e)))}
          >
            Try again
          </button>
        )}
      </div>
    );
  const props = { data, repo: repo!, refresh, notify };
  return (
    <>
      <div className="app-shell">
        <aside className={"sidebar " + (mobile ? "is-open" : "")}>
          <Brand />
          <button
            className="mobile-close icon-btn"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
          <div className="restaurant-switch">
            <span className="restaurant-avatar">
              {data.settings.name.slice(0, 1)}
            </span>
            <div>
              <strong>{data.settings.name}</strong>
              <small>Restaurant workspace</small>
            </div>
            <ChevronRight size={15} />
          </div>
          <span className="nav-label">WORKSPACE</span>
          <nav>
            {NAV.map(([name, Icon]) => (
              <button
                key={name}
                className={page === name ? "active" : ""}
                onClick={() => navigate(name)}
              >
                <Icon size={19} />
                <span>{name}</span>
                {page === name && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="workspace-note">
              <Leaf size={17} />
              <span>
                Made for better service.
                <small>One thoughtful detail at a time.</small>
              </span>
            </div>
            <div className="user-card">
              <span className="user-avatar">
                {user ? user[0].toUpperCase() : "A"}
              </span>
              <div>
                <strong>{cloud ? "Restaurant admin" : "Alex Morgan"}</strong>
                <small>{cloud ? user : "Demo workspace"}</small>
              </div>
              {cloud ? (
                <button
                  className="icon-btn"
                  aria-label="Sign out"
                  onClick={() => void supabase?.auth.signOut()}
                >
                  <LogOut size={17} />
                </button>
              ) : (
                <ShieldCheck size={18} />
              )}
            </div>
          </div>
        </aside>
        {mobile && (
          <div className="nav-overlay" onClick={() => setMobile(false)} />
        )}
        <div className="workspace-main">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-btn mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{page}</strong>
            </div>
            <div className="topbar-right">
              <span className={"mode-badge " + (cloud ? "cloud" : "")}>
                <span className="dot" />
                {cloud ? "Cloud workspace" : "Demo mode · this browser"}
              </span>
              <span className="topbar-date">
                {new Date().toLocaleDateString(CONFIG.locale, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="topbar-avatar">
                {data.settings.name.slice(0, 1)}
              </span>
            </div>
          </header>
          <main className="page-content">
            {page === "Dashboard" && (
              <Overview
                data={data}
                onReceipt={setReceipt}
                navigate={navigate}
              />
            )}
            <div
              style={{ display: page === "Point of Sale" ? "block" : "none" }}
            >
              <POS
                {...props}
                onSale={async (sale) => {
                  setReceipt(sale);
                  try {
                    await refresh();
                    notify("Payment recorded. Your receipt is ready.");
                  } catch {
                    notify(
                      "Sale saved. Your receipt is ready; refresh to update the overview.",
                    );
                  }
                }}
              />
            </div>
            {page === "Products" && <Products {...props} />}{" "}
            {page === "Transactions" && (
              <Transactions data={data} onReceipt={setReceipt} />
            )}{" "}
            {page === "Income" && (
              <Ledger key="income" type="income" {...props} />
            )}{" "}
            {page === "Expenses" && (
              <Ledger key="expenses" type="expenses" {...props} />
            )}{" "}
            {page === "Reports" && (
              <Overview
                report
                data={data}
                onReceipt={setReceipt}
                navigate={navigate}
              />
            )}{" "}
            {page === "Settings" && <SettingsPage {...props} />}
          </main>
          <footer className="app-footer">
            <span>
              {CONFIG.appName} <span> / </span> {data.settings.name}
            </span>
            <span>
              {cloud
                ? "Private restaurant workspace"
                : "Demo Mode · sample data and changes saved on this browser"}
            </span>
          </footer>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {receipt && (
        <Modal title="Payment recorded" wide onClose={() => setReceipt(null)}>
          <ReceiptView
            receipt={receipt.receipt}
            phone={receipt.customer.phone}
            email={receipt.customer.email}
          />
        </Modal>
      )}
    </>
  );
}
function CloudWelcome({
  needsSetup,
  user,
  error,
  onSetup,
}: {
  needsSetup: boolean;
  user: string;
  error: string;
  onSetup: (id: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [localError, setLocalError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="welcome">
      <section className="welcome-story">
        <Brand />
        <div>
          <span className="eyebrow">LESS ADMIN. MORE HOSPITALITY.</span>
          <h1>
            Your restaurant.
            <br />
            Beautifully in order.
          </h1>
          <p>
            From the first espresso to the last receipt,
            <br />
            {CONFIG.appName} keeps every detail together.
          </p>
        </div>
        <span>{CONFIG.restaurantName} · Restaurant workspace</span>
      </section>
      <section className="welcome-form">
        <Leaf size={30} />
        <h2>{needsSetup ? "A home for your restaurant" : "Welcome back"}</h2>
        <p>
          {needsSetup
            ? `Signed in as ${user}. Create your private restaurant workspace with a starter menu.`
            : "Sign in to your secure restaurant workspace."}
        </p>
        {needsSetup ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setLocalError("");
              try {
                const categories = initialCategories(),
                  products = initialMenu(categories);
                const id = check(
                  await supabase!.rpc("create_restaurant", {
                    p_settings: DEFAULT_SETTINGS,
                    p_categories: categories,
                    p_products: products,
                  }),
                );
                onSetup(id);
              } catch (e) {
                setLocalError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating workspace…" : "Create restaurant workspace"}
            <ArrowRight size={17} />
          </button>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setLocalError("");
              try {
                check(
                  await supabase!.auth.signInWithPassword({ email, password }),
                );
              } catch (e) {
                setLocalError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email address">
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                autoComplete="current-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="button primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
            <p className="form-hint">
              Ask your workspace owner for an admin account. New accounts are
              created in Supabase Authentication.
            </p>
          </form>
        )}
        {(localError || error) && (
          <div className="form-error" role="alert">
            {localError || error}
          </div>
        )}
        {needsSetup && (
          <button
            className="text-button"
            onClick={() => void supabase?.auth.signOut()}
          >
            Sign out
          </button>
        )}
      </section>
    </main>
  );
}
