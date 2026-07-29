"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchConfig,
  fetchRef,
  postInvoice,
  clientRules,
  type AppConfig,
  type RefOption,
} from "@/lib/client";
import { SCENARIOS } from "@/lib/scenarios";
import { readFbrResponse } from "@/lib/fbrErrors";
import type { FbrInvoiceResponse } from "@/lib/types";
import type { PreflightIssue, Fill } from "@/lib/preflight";
import ItemRow, { EMPTY_ITEM, type ItemFormState } from "./ItemRow";
import Combobox from "./Combobox";

function issueLabel(issue: PreflightIssue): string {
  const where = issue.row ? `Item ${issue.row} · ${issue.field}` : issue.field;
  return `${where}: ${issue.message}`;
}

const SCENARIO_OPTIONS: RefOption[] = SCENARIOS.map((s) => ({
  value: s.id,
  label: `${s.id} — ${s.description}`,
}));

function money(n: number): string {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface HeaderState {
  invoiceType: "Sale Invoice" | "Debit Note";
  invoiceDate: string;
  sellerNTNCNIC: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
  buyerRegistrationType: "Registered" | "Unregistered";
  buyerNTNCNIC: string;
  buyerBusinessName: string;
  buyerProvince: string;
  buyerAddress: string;
  invoiceRefNo: string;
  scenarioId: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type ResultState =
  | { kind: "ok"; message: string; invoiceNumber?: string; response: FbrInvoiceResponse }
  | { kind: "err"; message: string; details?: string[] }
  | null;

// Extract province options from the provinces reference response.
function toProvinceOptions(data: unknown): RefOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => {
      const o = p as Record<string, unknown>;
      const desc = String(o.stateProvinceDesc ?? "");
      return { value: desc, label: desc, raw: o };
    })
    .filter((o) => o.value);
}

function toUomOptions(data: unknown): RefOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => {
      const o = p as Record<string, unknown>;
      const desc = String(o.description ?? "");
      return { value: desc, label: desc, raw: o };
    })
    .filter((o) => o.value);
}

function toHsOptions(data: unknown): RefOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => {
      const o = p as Record<string, unknown>;
      const code = String(o.hS_CODE ?? o.hs_code ?? "");
      const desc = String(o.description ?? "");
      return { value: code, label: desc ? `${code} — ${desc.slice(0, 80)}` : code, raw: o };
    })
    .filter((o) => o.value);
}

function toRateOptions(data: unknown): RefOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => {
      const o = p as Record<string, unknown>;
      const desc = String(o.ratE_DESC ?? o.rate_DESC ?? "");
      return { value: desc, label: desc, raw: o };
    })
    .filter((o) => o.value);
}

// Sale-type options for the item dropdown. Several scenarios share the same
// saleType, so dedupe to avoid duplicate React keys.
const SALE_TYPE_OPTIONS: RefOption[] = Array.from(
  new Set(SCENARIOS.map((s) => s.saleType)),
).map((t) => ({ value: t, label: t }));

export default function InvoiceForm() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [provinces, setProvinces] = useState<RefOption[]>([]);
  const [uoms, setUoms] = useState<RefOption[]>([]);
  const [hsCodes, setHsCodes] = useState<RefOption[]>([]);
  const [rates, setRates] = useState<RefOption[]>([]);
  const [refError, setRefError] = useState<string | null>(null);

  const [header, setHeader] = useState<HeaderState>({
    invoiceType: "Sale Invoice",
    invoiceDate: today(),
    sellerNTNCNIC: "",
    sellerBusinessName: "",
    sellerProvince: "",
    sellerAddress: "",
    buyerRegistrationType: "Registered",
    buyerNTNCNIC: "",
    buyerBusinessName: "",
    buyerProvince: "",
    buyerAddress: "",
    invoiceRefNo: "",
    scenarioId: "SN001",
  });

  const [items, setItems] = useState<ItemFormState[]>([{ ...EMPTY_ITEM }]);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState<"validate" | "submit" | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [copied, setCopied] = useState(false);

  const isSandbox = config?.env !== "production";

  const grandTotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.totalValues || "0") || 0),
    0,
  );
  const grandTax = items.reduce(
    (sum, it) => sum + (parseFloat(it.salesTaxApplicable || "0") || 0),
    0,
  );

  function copyInvoiceNumber(num: string) {
    navigator.clipboard?.writeText(num).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // Load config + reference data on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchConfig();
        if (cancelled) return;
        setConfig(cfg);
        setHeader((h) => ({
          ...h,
          sellerNTNCNIC: cfg.seller.sellerNTNCNIC || h.sellerNTNCNIC,
          sellerBusinessName: cfg.seller.sellerBusinessName || h.sellerBusinessName,
          sellerProvince: cfg.seller.sellerProvince || h.sellerProvince,
          sellerAddress: cfg.seller.sellerAddress || h.sellerAddress,
        }));
      } catch (e) {
        if (!cancelled) setRefError(e instanceof Error ? e.message : "Failed to load config.");
      }

      const loaders: Array<[string, (d: unknown) => void]> = [
        ["provinces", (d) => setProvinces(toProvinceOptions(d))],
        ["uom", (d) => setUoms(toUomOptions(d))],
        ["itemdesccode", (d) => setHsCodes(toHsOptions(d))],
      ];
      for (const [resource, apply] of loaders) {
        try {
          const data = await fetchRef(resource);
          if (!cancelled) apply(data);
        } catch (e) {
          if (!cancelled) {
            setRefError(
              (prev) =>
                prev ??
                `Couldn't load "${resource}" reference data (${
                  e instanceof Error ? e.message : "error"
                }). You can still type values manually.`,
            );
          }
        }
      }

      // Rates depend on date/transType/province; load a default set so the rate
      // dropdown has common options. Falls back silently to free-text.
      try {
        const data = await fetchRef("SaleTypeToRate", {
          date: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).replace(/ /g, "-"),
          transTypeId: "18",
          originationSupplier: "1",
        });
        if (!cancelled) setRates(toRateOptions(data));
      } catch {
        // ignore — rate is free-text capable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setH<K extends keyof HeaderState>(key: K, value: HeaderState[K]) {
    setHeader((h) => ({ ...h, [key]: value }));
    setValidated(false);
  }

  function updateItem(index: number, item: ItemFormState) {
    setItems((arr) => arr.map((it, i) => (i === index ? item : it)));
    setValidated(false);
  }

  function addItem() {
    setItems((arr) => [...arr, { ...EMPTY_ITEM }]);
    setValidated(false);
  }

  function removeItem(index: number) {
    setItems((arr) => arr.filter((_, i) => i !== index));
    setValidated(false);
  }

  function buildBody() {
    const body: Record<string, unknown> = {
      invoiceType: header.invoiceType,
      invoiceDate: header.invoiceDate,
      sellerNTNCNIC: header.sellerNTNCNIC,
      sellerBusinessName: header.sellerBusinessName,
      sellerProvince: header.sellerProvince,
      sellerAddress: header.sellerAddress,
      buyerRegistrationType: header.buyerRegistrationType,
      buyerNTNCNIC: header.buyerNTNCNIC,
      buyerBusinessName: header.buyerBusinessName,
      buyerProvince: header.buyerProvince,
      buyerAddress: header.buyerAddress,
      invoiceRefNo: header.invoiceRefNo,
      items,
    };
    if (isSandbox) body.scenarioId = header.scenarioId;
    return body;
  }

  function interpret(data: unknown): ResultState {
    const resp = data as FbrInvoiceResponse & { error?: string; detail?: string };
    if (resp?.error) {
      return { kind: "err", message: resp.error };
    }
    const vr = resp?.validationResponse;
    if (!vr) {
      return { kind: "err", message: "Unexpected response from FBR." };
    }
    if (vr.statusCode === "00") {
      return {
        kind: "ok",
        message: resp.invoiceNumber
          ? "Invoice accepted by FBR."
          : "Invoice is valid.",
        invoiceNumber: resp.invoiceNumber,
        response: resp,
      };
    }
    // Invalid — collect per-item errors plus the top-level error.
    const details: string[] = [];
    if (vr.error) details.push(`${vr.errorCode ? vr.errorCode + ": " : ""}${vr.error}`);
    for (const s of vr.invoiceStatuses ?? []) {
      if (s.statusCode !== "00" && s.error) {
        details.push(`Item ${s.itemSNo}: ${s.errorCode ? s.errorCode + " — " : ""}${s.error}`);
      }
    }
    return {
      kind: "err",
      message: "FBR rejected the invoice.",
      details: details.length ? details : ["No further detail provided."],
    };
  }

  async function run(kind: "validate" | "submit") {
    setBusy(kind);
    setResult(null);
    try {
      const { data } = await postInvoice(kind, buildBody());
      const r = interpret(data);
      setResult(r);
      if (kind === "validate") setValidated(r?.kind === "ok");
      if (kind === "submit" && r?.kind === "ok") {
        // After a real submission, force re-validate before another submit.
        setValidated(false);
      }
    } catch (e) {
      setResult({ kind: "err", message: e instanceof Error ? e.message : "Request failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {refError && (
        <div className="notice notice-warn">
          <span className="notice-icon">!</span>
          <div>
            <strong>Reference data note:</strong> {refError}
          </div>
        </div>
      )}

      <section className="card">
        <header className="card-head">
          <span className="card-icon icon-doc" aria-hidden="true" />
          <h2>Invoice</h2>
        </header>
        <div className="grid grid-4">
          <div className="field">
            <label>Invoice type *</label>
            <div className="seg">
              {(["Sale Invoice", "Debit Note"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`seg-btn ${header.invoiceType === t ? "active" : ""}`}
                  onClick={() => setH("invoiceType", t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Invoice date *</label>
            <input
              type="date"
              value={header.invoiceDate}
              onChange={(e) => setH("invoiceDate", e.target.value)}
            />
          </div>
          {header.invoiceType === "Debit Note" && (
            <div className="field">
              <label>Reference invoice no *</label>
              <input
                value={header.invoiceRefNo}
                onChange={(e) => setH("invoiceRefNo", e.target.value)}
                placeholder="Original invoice number"
              />
            </div>
          )}
          {isSandbox && (
            <div className="field field-wide">
              <label>Scenario (sandbox) *</label>
              <Combobox
                value={header.scenarioId}
                options={SCENARIO_OPTIONS}
                onChange={(v) => setH("scenarioId", v.split(" ")[0] || v)}
                allowFreeText={false}
                placeholder="Search scenario…"
                ariaLabel="Sandbox scenario"
              />
              <div className="hint">Required for sandbox testing only.</div>
            </div>
          )}
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <header className="card-head">
            <span className="card-icon icon-seller" aria-hidden="true" />
            <h2>Seller</h2>
          </header>
          <div className="grid">
            <div className="field">
              <label>Seller NTN / CNIC *</label>
              <input
                value={header.sellerNTNCNIC}
                onChange={(e) => setH("sellerNTNCNIC", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Seller business name *</label>
              <input
                value={header.sellerBusinessName}
                onChange={(e) => setH("sellerBusinessName", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Seller province *</label>
              <Combobox
                value={header.sellerProvince}
                options={provinces}
                onChange={(v) => setH("sellerProvince", v)}
                placeholder="Search province…"
                ariaLabel="Seller province"
              />
            </div>
            <div className="field">
              <label>Seller address *</label>
              <input
                value={header.sellerAddress}
                onChange={(e) => setH("sellerAddress", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <header className="card-head">
            <span className="card-icon icon-buyer" aria-hidden="true" />
            <h2>Buyer</h2>
          </header>
          <div className="grid">
            <div className="field">
              <label>Buyer registration type *</label>
              <div className="seg">
                {(["Registered", "Unregistered"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`seg-btn ${header.buyerRegistrationType === t ? "active" : ""}`}
                    onClick={() => setH("buyerRegistrationType", t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>
                Buyer NTN / CNIC {header.buyerRegistrationType === "Registered" ? "*" : "(optional)"}
              </label>
              <input
                value={header.buyerNTNCNIC}
                onChange={(e) => setH("buyerNTNCNIC", e.target.value)}
                placeholder={
                  header.buyerRegistrationType === "Unregistered"
                    ? "Blank → 1000000000000"
                    : ""
                }
              />
            </div>
            <div className="field">
              <label>Buyer business name *</label>
              <input
                value={header.buyerBusinessName}
                onChange={(e) => setH("buyerBusinessName", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Buyer province *</label>
              <Combobox
                value={header.buyerProvince}
                options={provinces}
                onChange={(v) => setH("buyerProvince", v)}
                placeholder="Search province…"
                ariaLabel="Buyer province"
              />
            </div>
            <div className="field">
              <label>Buyer address *</label>
              <input
                value={header.buyerAddress}
                onChange={(e) => setH("buyerAddress", e.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <header className="card-head">
          <span className="card-icon icon-items" aria-hidden="true" />
          <h2>Items</h2>
          <span className="card-head-meta">{items.length} item{items.length > 1 ? "s" : ""}</span>
        </header>
        {items.map((item, i) => (
          <ItemRow
            key={i}
            index={i}
            item={item}
            hsCodes={hsCodes}
            uoms={uoms}
            rates={rates}
            saleTypes={SALE_TYPE_OPTIONS}
            canRemove={items.length > 1}
            onChange={updateItem}
            onRemove={removeItem}
          />
        ))}
        <button type="button" className="btn-add" onClick={addItem}>
          <span className="plus">+</span> Add item
        </button>
      </section>

      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-label">Sales tax</span>
          <span className="summary-value">Rs {money(grandTax)}</span>
        </div>
        <div className="summary-item summary-grand">
          <span className="summary-label">Invoice total</span>
          <span className="summary-value">Rs {money(grandTotal)}</span>
        </div>
      </div>

      {result && (
        <div className={`result ${result.kind}`}>
          <div className="result-head">
            <span className={`result-dot ${result.kind}`} />
            <span>{result.message}</span>
          </div>
          {result.kind === "ok" && result.invoiceNumber && (
            <div className="result-invoice">
              <span className="muted">FBR invoice number</span>
              <div className="invoice-number-row">
                <span className="invoice-number">{result.invoiceNumber}</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => copyInvoiceNumber(result.invoiceNumber!)}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <Link
                  href={`/invoice/${encodeURIComponent(result.invoiceNumber)}`}
                  className="copy-btn"
                  target="_blank"
                >
                  Print invoice →
                </Link>
              </div>
            </div>
          )}
          {result.kind === "err" && result.details && (
            <ul className="result-errors">
              {result.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="action-bar">
        <span className={`status-pill ${validated ? "ready" : ""}`}>
          {validated ? "✓ Validated — ready to submit" : "Validate first to unlock submit"}
        </span>
        <div className="action-bar-btns">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => run("validate")}
            disabled={busy !== null}
          >
            {busy === "validate" ? "Validating…" : "Validate"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => run("submit")}
            disabled={busy !== null || !validated}
            title={!validated ? "Validate successfully first" : "Submit to FBR"}
          >
            {busy === "submit" ? "Submitting…" : "Submit to FBR"}
          </button>
        </div>
      </div>
    </form>
  );
}
