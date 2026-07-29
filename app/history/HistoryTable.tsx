"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LoggedInvoice } from "@/lib/types";

export default function HistoryTable() {
  const [rows, setRows] = useState<LoggedInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invoices", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);

  if (error)
    return (
      <div className="result err">
        <div className="result-head">
          <span className="result-dot err" />
          <span>{error}</span>
        </div>
      </div>
    );
  if (rows === null) return <div className="empty-state">Loading…</div>;
  if (rows.length === 0)
    return (
      <div className="card">
        <div className="empty-state">
          No invoices submitted yet.
          <br />
          Submitted invoices will appear here.
        </div>
      </div>
    );

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table>
        <thead>
          <tr>
            <th>Invoice number</th>
            <th>Dated</th>
            <th>Type</th>
            <th>Buyer</th>
            <th>Total</th>
            <th>Env</th>
            <th>Scenario</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.invoiceNumber}>
              <td>
                <code className="mono">{r.invoiceNumber}</code>
              </td>
              <td>{r.dated}</td>
              <td>{r.invoiceType}</td>
              <td>{r.buyerBusinessName}</td>
              <td>{r.total.toLocaleString()}</td>
              <td>{r.env}</td>
              <td>{r.scenarioId ?? "—"}</td>
              <td>
                <Link
                  href={`/invoice/${encodeURIComponent(r.invoiceNumber)}`}
                  target="_blank"
                >
                  Print
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
