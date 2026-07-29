"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LoggedInvoice, InvoiceItem } from "@/lib/types";

interface Data {
  invoice: LoggedInvoice;
  qrDataUrl: string;
}

function money(n: number): string {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export default function PrintableInvoice({ invoiceNumber }: { invoiceNumber: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${encodeURIComponent(invoiceNumber)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load invoice.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, [invoiceNumber]);

  if (error) {
    return (
      <div className="print-wrap">
        <div className="result err" style={{ margin: 24 }}>
          {error} <Link href="/history">Back to history</Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="print-wrap" style={{ padding: 40 }}>Loading invoice…</div>;

  const inv = data.invoice;
  const p = inv.payload;
  const items: InvoiceItem[] = p?.items ?? [];

  const totals = items.reduce(
    (acc, it) => {
      acc.excl += num(it.valueSalesExcludingST);
      acc.tax += num(it.salesTaxApplicable);
      acc.further += num(it.furtherTax);
      acc.extra += num(it.extraTax);
      acc.fed += num(it.fedPayable);
      acc.discount += num(it.discount);
      acc.total += num(it.totalValues);
      return acc;
    },
    { excl: 0, tax: 0, further: 0, extra: 0, fed: 0, discount: 0, total: 0 },
  );

  return (
    <div className="print-wrap">
      <div className="print-toolbar no-print">
        <Link href="/history" className="btn-secondary">
          ← Back
        </Link>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            Save as PDF
          </button>
        </div>
      </div>

      <div className="invoice-sheet" id="invoice-sheet">
        {/* Letterhead */}
        <header className="inv-head">
          <div className="inv-seller">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/pit-full.webp" alt="Perception IT" className="inv-pit-logo" />
            <div className="inv-seller-meta">
              {p?.sellerBusinessName && p.sellerBusinessName !== "Perception IT" && (
                <div className="inv-seller-name">{p.sellerBusinessName}</div>
              )}
              NTN/CNIC: {p?.sellerNTNCNIC || "—"}
              <br />
              {p?.sellerAddress}
              {p?.sellerProvince ? `, ${p.sellerProvince}` : ""}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/fbr-logo.png" alt="FBR Pakistan" className="inv-fbr-logo" />
        </header>

        <div className="inv-title-row">
          <h1>{inv.invoiceType === "Debit Note" ? "Debit Note" : "Sales Tax Invoice"}</h1>
          {inv.env === "sandbox" && <span className="inv-sandbox-tag">SANDBOX / TEST</span>}
        </div>

        {/* Meta + buyer */}
        <section className="inv-meta-grid">
          <div className="inv-box">
            <div className="inv-box-title">Bill to</div>
            <div className="inv-box-name">{p?.buyerBusinessName || inv.buyerBusinessName}</div>
            <div className="inv-box-line">
              {p?.buyerRegistrationType ?? "—"}
              {inv.buyerNTNCNIC ? ` · NTN/CNIC: ${inv.buyerNTNCNIC}` : ""}
            </div>
            <div className="inv-box-line">
              {p?.buyerAddress}
              {p?.buyerProvince ? `, ${p.buyerProvince}` : ""}
            </div>
          </div>
          <div className="inv-box">
            <div className="inv-kv">
              <span>FBR Invoice No.</span>
              <strong className="inv-fbr-number">{inv.invoiceNumber}</strong>
            </div>
            <div className="inv-kv">
              <span>Date</span>
              <strong>{p?.invoiceDate || inv.dated}</strong>
            </div>
            {inv.scenarioId && (
              <div className="inv-kv">
                <span>Scenario</span>
                <strong>{inv.scenarioId}</strong>
              </div>
            )}
            {p?.invoiceRefNo && (
              <div className="inv-kv">
                <span>Ref invoice</span>
                <strong>{p.invoiceRefNo}</strong>
              </div>
            )}
          </div>
        </section>

        {/* Items */}
        <table className="inv-items">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HS Code</th>
              <th className="r">Qty</th>
              <th className="r">Rate</th>
              <th className="r">Value excl. ST</th>
              <th className="r">Sales tax</th>
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="inv-noitems">
                  Line-item detail not stored for this invoice (logged before printable view).
                </td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.productDescription}</td>
                <td>{it.hsCode}</td>
                <td className="r">{num(it.quantity)}</td>
                <td className="r">{it.rate}</td>
                <td className="r">{money(num(it.valueSalesExcludingST))}</td>
                <td className="r">{money(num(it.salesTaxApplicable))}</td>
                <td className="r">{money(num(it.totalValues))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="inv-totals">
          <div className="inv-total-line">
            <span>Value excl. sales tax</span>
            <span>Rs {money(totals.excl)}</span>
          </div>
          <div className="inv-total-line">
            <span>Sales tax</span>
            <span>Rs {money(totals.tax)}</span>
          </div>
          {totals.further > 0 && (
            <div className="inv-total-line">
              <span>Further tax</span>
              <span>Rs {money(totals.further)}</span>
            </div>
          )}
          {totals.extra > 0 && (
            <div className="inv-total-line">
              <span>Extra tax</span>
              <span>Rs {money(totals.extra)}</span>
            </div>
          )}
          {totals.fed > 0 && (
            <div className="inv-total-line">
              <span>FED payable</span>
              <span>Rs {money(totals.fed)}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="inv-total-line">
              <span>Discount</span>
              <span>− Rs {money(totals.discount)}</span>
            </div>
          )}
          <div className="inv-total-line grand">
            <span>Total payable</span>
            <span>Rs {money(totals.total || inv.total)}</span>
          </div>
        </div>

        {/* FBR compliance footer: DI logo + QR (1x1 inch) per spec section 6 */}
        <footer className="inv-footer">
          <div className="inv-footer-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/di-system.svg" alt="FBR Digital Invoicing System" className="inv-di-logo" />
            <div className="inv-footer-note">
              This invoice has been reported to the Federal Board of Revenue (FBR) through its
              Digital Invoicing System. Scan the QR code to verify.
            </div>
          </div>
          <div className="inv-qr-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.qrDataUrl} alt="FBR invoice QR code" className="inv-qr" />
            <div className="inv-qr-cap">{inv.invoiceNumber}</div>
          </div>
        </footer>

        <div className="inv-madeby">
          Generated by Perception IT · FBR Digital Invoicing Portal
        </div>
      </div>
    </div>
  );
}
