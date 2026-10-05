import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Image, Upload, X, ChevronDown, Leaf } from "lucide-react";
import { CONFIG } from "./config";
import { dateKey, money, today } from "./domain";
import { check, supabase } from "./store";
import type { Repository } from "./types";
export const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Something went wrong. Please try again.";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "small" : "")}>
      <span className="brand-mark">
        <Leaf size={21} />
      </span>
      <span>
        {CONFIG.appName}
        <small>RESTAURANT WORKSPACE</small>
      </span>
    </div>
  );
}
export function Media({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState(src.startsWith("private:") ? "" : src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    let active = true;
    if (src.startsWith("private:"))
      supabase?.storage
        .from("bistro-private")
        .createSignedUrl(src.slice(8), 3600)
        .then((r) => {
          if (active) {
            try {
              setUrl(check(r)?.signedUrl || "");
            } catch {
              setFailed(true);
            }
          }
        });
    else setUrl(src);
    return () => {
      active = false;
    };
  }, [src]);
  return url && !failed ? (
    <img
      className={className}
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={"media-fallback " + className} role="img" aria-label={alt}>
      <Image size={26} />
      <span>{alt || "No image"}</span>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    el?.querySelector<HTMLElement>("button,input,select")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && el) {
        const list = [
          ...el.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
          ),
        ];
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = body;
      document.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{CONFIG.appName}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  const control = children as ReactElement<{ "aria-label"?: string }>;
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        {cloneElement(control, {
          "aria-label": control.props["aria-label"] || label,
        })}
      </label>
      {help && <small>{help}</small>}
    </div>
  );
}
export function UploadField({
  value,
  onChange,
  repo,
  privateFile = false,
  label = "Photo",
  onError,
  onBusy,
}: {
  value: string;
  onChange: (url: string) => void;
  repo: Repository;
  privateFile?: boolean;
  label?: string;
  onError: (s: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="upload-field">
      <Media src={value} alt={label} />
      <div>
        <label className="button secondary upload-button">
          <Upload size={16} />
          {busy
            ? "Processing image…"
            : value
              ? "Replace image"
              : "Upload image"}
          <input
            aria-label={label + " upload"}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const control = e.currentTarget,
                file = control.files?.[0];
              if (!file) return;
              setBusy(true);
              onBusy?.(true);
              try {
                onChange(await repo.upload(file, privateFile));
              } catch (err) {
                onError(errorText(err));
              } finally {
                setBusy(false);
                onBusy?.(false);
                control.value = "";
              }
            }}
          />
        </label>
        <small>
          PNG, JPEG or WebP · up to 8 MB
          <br />
          Optimized automatically for faster loading.
        </small>
        {value && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => onChange("")}
          >
            Remove image
          </button>
        )}
      </div>
    </div>
  );
}
export type Range = { start: string; end: string; preset: string };
export function makeRange(preset = "Today", timeZone?: string): Range {
  const end = today(timeZone),
    d = new Date(end + "T12:00:00");
  if (preset === "This Week") {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
  }
  if (preset === "This Month") d.setDate(1);
  return { start: dateKey(d), end, preset };
}
export function DateFilter({
  value,
  onChange,
  timeZone,
}: {
  value: Range;
  onChange: (r: Range) => void;
  timeZone?: string;
}) {
  return (
    <div className="date-filter">
      <div className="select-wrap">
        <select
          aria-label="Date range"
          value={value.preset}
          onChange={(e) =>
            onChange(
              e.target.value === "Custom Range"
                ? { ...value, preset: "Custom Range" }
                : makeRange(e.target.value, timeZone),
            )
          }
        >
          {["Today", "This Week", "This Month", "Custom Range"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
      {value.preset === "Custom Range" && (
        <div className="range-inputs">
          <input
            aria-label="Start date"
            type="date"
            value={value.start}
            max={value.end}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
          <span>—</span>
          <input
            aria-label="End date"
            type="date"
            min={value.start}
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Leaf size={28} />
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Bars({
  items,
  currency,
  quantities = false,
}: {
  items: { name: string; amount: number }[];
  currency: string;
  quantities?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  return (
    <div className="bars">
      {items.length ? (
        items.slice(0, 7).map((i) => (
          <div className="bar-row" key={i.name}>
            <div>
              <span>{i.name}</span>
              <strong>
                {quantities ? i.amount + " sold" : money(i.amount, currency)}
              </strong>
            </div>
            <div className="bar-track">
              <span
                style={{ width: Math.max(2, (i.amount / max) * 100) + "%" }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No records in this period.</p>
      )}
    </div>
  );
}
export function Trend({
  points,
  currency,
}: {
  points: { label: string; income: number; expense: number }[];
  currency: string;
}) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expense))),
    w = 640,
    h = 180;
  const path = (key: "income" | "expense") =>
    points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${36 + (i * (w - 60)) / Math.max(1, points.length - 1)},${h - 18 - (p[key] / max) * (h - 40)}`,
      )
      .join(" ");
  return (
    <div className="trend">
      <div className="chart-legend">
        <span>
          <i />
          Revenue
        </span>
        <span>
          <i className="bronze" />
          Expenses
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h + 30}`}
        role="img"
        aria-label="Revenue and recorded expenses chart"
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="35"
              x2="626"
              y1={h - 18 - v * (h - 40)}
              y2={h - 18 - v * (h - 40)}
              stroke="var(--line)"
              strokeDasharray="4 4"
            />
            <text
              x="0"
              y={h - 14 - v * (h - 40)}
              fill="var(--muted)"
              fontSize="9"
            >
              {money(v * max, currency)}
            </text>
          </g>
        ))}
        <path
          d={path("income") + ` L${w - 24},${h - 18} L36,${h - 18}Z`}
          fill="var(--accent)"
          opacity=".08"
        />
        <path
          d={path("income")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path
          d={path("expense")}
          fill="none"
          stroke="var(--bronze)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={36 + (i * (w - 60)) / Math.max(1, points.length - 1)}
              cy={h - 18 - (p.income / max) * (h - 40)}
              r="3.5"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <title>
                {p.label}: {money(p.income, currency)} revenue,{" "}
                {money(p.expense, currency)} expenses
              </title>
            </circle>
            {(points.length <= 8 ||
              i % Math.ceil(points.length / 7) === 0 ||
              i === points.length - 1) && (
              <text
                x={36 + (i * (w - 60)) / Math.max(1, points.length - 1)}
                y={h + 10}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="10"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
export function csvDownload(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v);
          if (typeof v === "string" && /^[=+@-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
