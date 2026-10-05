import { useEffect, useState } from "react";
import {
  Printer,
  Mail,
  MessageCircle,
  ExternalLink,
  Leaf,
  Copy,
  Check,
} from "lucide-react";
import {
  decodeReceipt,
  money,
  niceDate,
  niceTime,
  receiptURL,
  shareLinks,
} from "./domain";
import { check, supabase } from "./store";
import { errorText, Media } from "./ui";
import type { Receipt as ReceiptType } from "./types";
export function ReceiptView({
  receipt,
  phone = "",
  email = "",
  standalone = false,
}: {
  receipt: ReceiptType;
  phone?: string;
  email?: string;
  standalone?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [paper, setPaper] = useState("thermal");
  useEffect(() => {
    document.body.dataset.printFormat = paper;
    return () => {
      delete document.body.dataset.printFormat;
    };
  }, [paper]);
  useEffect(() => {
    receiptURL(receipt)
      .then(setUrl)
      .catch((e) => setError(errorText(e)));
  }, [receipt]);
  const links = shareLinks(receipt, url, phone, email),
    m = (value: number) => money(value, receipt.currency);
  return (
    <div className={standalone ? "receipt-shell" : "receipt-container"}>
      <article className="receipt-paper" id="print-receipt">
        <header>
          {receipt.restaurant.logo ? (
            <Media
              src={receipt.restaurant.logo}
              alt={receipt.restaurant.name}
              className="receipt-logo"
            />
          ) : (
            <div className="receipt-monogram">
              <Leaf size={25} />
            </div>
          )}
          <span className="eyebrow">A MOMENT WELL SPENT</span>
          <h1>{receipt.restaurant.name}</h1>
          {receipt.restaurant.address && <p>{receipt.restaurant.address}</p>}
          <span className="paid-stamp">PAID · {receipt.paymentMethod}</span>
        </header>
        <div className="receipt-meta">
          <div>
            <small>RECEIPT NUMBER</small>
            <strong>{receipt.number}</strong>
          </div>
          <div>
            <small>DATE & TIME</small>
            <span>
              {niceDate(receipt.createdAt, receipt.restaurant.timeZone)} ·{" "}
              {niceTime(receipt.createdAt, receipt.restaurant.timeZone)}
            </span>
          </div>
          {receipt.customerName && (
            <div>
              <small>CUSTOMER</small>
              <span>{receipt.customerName}</span>
            </div>
          )}
          {receipt.table && (
            <div>
              <small>TABLE</small>
              <span>{receipt.table}</span>
            </div>
          )}
        </div>
        <div className="receipt-items">
          <div className="receipt-item head">
            <span>ITEM</span>
            <span>AMOUNT</span>
          </div>
          {receipt.items.map((item, i) => (
            <div className="receipt-item" key={i}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.quantity} × {m(item.priceCents)}
                </small>
                {item.notes && <small>{item.notes}</small>}
              </div>
              <strong>{m(item.priceCents * item.quantity)}</strong>
            </div>
          ))}
        </div>
        <div className="receipt-totals">
          <div>
            <span>Subtotal</span>
            <span>{m(receipt.subtotalCents)}</span>
          </div>
          {receipt.discountCents > 0 && (
            <div>
              <span>Discount</span>
              <span>−{m(receipt.discountCents)}</span>
            </div>
          )}
          {receipt.restaurant.taxRate > 0 && (
            <div>
              <span>Sales tax ({receipt.restaurant.taxRate}%)</span>
              <span>{m(receipt.taxCents)}</span>
            </div>
          )}
          {receipt.restaurant.serviceRate > 0 && (
            <div>
              <span>Service charge ({receipt.restaurant.serviceRate}%)</span>
              <span>{m(receipt.serviceCents)}</span>
            </div>
          )}
          <div className="receipt-total">
            <strong>Total paid</strong>
            <strong>{m(receipt.totalCents)}</strong>
          </div>
          {receipt.paymentMethod === "Cash" && (
            <>
              <div>
                <span>Cash received</span>
                <span>{m(receipt.receivedCents)}</span>
              </div>
              <div>
                <span>Change</span>
                <span>{m(receipt.changeCents)}</span>
              </div>
            </>
          )}
        </div>
        {receipt.notes && <p className="receipt-note">{receipt.notes}</p>}
        <footer>
          <p>{receipt.restaurant.footer}</p>
          {receipt.restaurant.phone && <p>{receipt.restaurant.phone}</p>}
          {receipt.restaurant.email && <p>{receipt.restaurant.email}</p>}
          <small>
            {receipt.currency} · {receipt.number}
          </small>
        </footer>
      </article>
      <div className="receipt-actions no-print">
        <select
          aria-label="Receipt paper size"
          value={paper}
          onChange={(e) => setPaper(e.target.value)}
        >
          <option value="thermal">Thermal · 80 mm</option>
          <option value="a4">A4 page</option>
        </select>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={17} />
          Print receipt
        </button>
        <a
          className={"button secondary " + (!url ? "disabled" : "")}
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} />
          Send via WhatsApp
        </a>
        <a
          className={"button secondary " + (!url ? "disabled" : "")}
          href={links.email}
        >
          <Mail size={17} />
          Send via email
        </a>
        {!standalone && (
          <a
            className={"button secondary " + (!url ? "disabled" : "")}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={17} />
            Online receipt
          </a>
        )}
        <button
          className="button secondary"
          disabled={!url}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setError(
                "Copy is unavailable in this browser. Use Online receipt to open the link.",
              );
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}Copy link
        </button>
      </div>
      <p className="receipt-disclosure no-print">
        Email opens your mail app with a prepared message. WhatsApp opens a
        prepared share; nothing is sent automatically.
        {receipt.demo &&
          " Demo receipts use a shareable snapshot in the URL. They are not verified business records."}
      </p>
      {error && (
        <div role="alert" className="form-error no-print">
          {error}
        </div>
      )}
    </div>
  );
}
export function PublicReceipt({ token }: { token: string }) {
  const [receipt, setReceipt] = useState<ReceiptType | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!/^[0-9a-f-]{36}$/i.test(token))
          throw Error("This receipt link is invalid.");
        const encoded = new URLSearchParams(location.hash.slice(1)).get("demo");
        let r: ReceiptType;
        if (encoded) r = await decodeReceipt(encoded, token);
        else if (supabase) {
          r = check(
            await supabase.rpc("get_public_receipt", { p_token: token }),
          );
          if (!r)
            throw Error(
              "Receipt not found. Please ask the restaurant for a new link.",
            );
        } else
          throw Error(
            "Receipt not found. Demo receipts must include their complete share link.",
          );
        if (active) {
          setReceipt(r);
          document.title = r.restaurant.name + " · Receipt " + r.number;
        }
      } catch (e) {
        if (active) setError(errorText(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <main className="public-receipt">
      <div className="public-label no-print">
        <Leaf size={17} />
        {receipt?.demo ? "DEMO RECEIPT · SHARED SNAPSHOT" : "DIGITAL RECEIPT"}
      </div>
      {receipt ? (
        <ReceiptView receipt={receipt} standalone />
      ) : error ? (
        <div className="receipt-unavailable">
          <h1>Receipt unavailable</h1>
          <p>{error}</p>
        </div>
      ) : (
        <p className="loading">Loading your receipt…</p>
      )}
    </main>
  );
}
