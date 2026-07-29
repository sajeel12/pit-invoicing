"use client";

import type { RefOption } from "@/lib/client";
import Combobox from "./Combobox";

export interface ItemFormState {
  hsCode: string;
  productDescription: string;
  rate: string;
  uoM: string;
  quantity: string;
  valueSalesExcludingST: string;
  salesTaxApplicable: string;
  totalValues: string;
  fixedNotifiedValueOrRetailPrice: string;
  salesTaxWithheldAtSource: string;
  furtherTax: string;
  extraTax: string;
  fedPayable: string;
  discount: string;
  saleType: string;
  sroScheduleNo: string;
  sroItemSerialNo: string;
}

export const EMPTY_ITEM: ItemFormState = {
  hsCode: "",
  productDescription: "",
  rate: "",
  uoM: "",
  quantity: "1",
  valueSalesExcludingST: "",
  salesTaxApplicable: "",
  totalValues: "",
  fixedNotifiedValueOrRetailPrice: "0",
  salesTaxWithheldAtSource: "0",
  furtherTax: "0",
  extraTax: "0",
  fedPayable: "0",
  discount: "0",
  saleType: "",
  sroScheduleNo: "",
  sroItemSerialNo: "",
};

// Parse "18%" -> 18. Returns null if no usable percentage.
function ratePercent(rate: string): number | null {
  const m = rate.match(/([\d.]+)\s*%/);
  if (m) return parseFloat(m[1]);
  return null;
}

function money(n: number): string {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  index: number;
  item: ItemFormState;
  hsCodes: RefOption[];
  uoms: RefOption[];
  rates: RefOption[];
  saleTypes: RefOption[];
  canRemove: boolean;
  onChange: (index: number, item: ItemFormState) => void;
  onRemove: (index: number) => void;
}

export default function ItemRow({
  index,
  item,
  hsCodes,
  uoms,
  rates,
  saleTypes,
  canRemove,
  onChange,
  onRemove,
}: Props) {
  function set<K extends keyof ItemFormState>(key: K, value: string) {
    onChange(index, { ...item, [key]: value });
  }

  // Recompute salesTaxApplicable + totalValues from excl-ST value and rate.
  function recalcTax(next: ItemFormState): ItemFormState {
    const pct = ratePercent(next.rate);
    const exclTotal = parseFloat(next.valueSalesExcludingST || "0") || 0;
    if (pct === null) return next;
    const tax = +(exclTotal * (pct / 100)).toFixed(2);
    const further = parseFloat(next.furtherTax || "0") || 0;
    const extra = parseFloat(next.extraTax || "0") || 0;
    const fed = parseFloat(next.fedPayable || "0") || 0;
    const discount = parseFloat(next.discount || "0") || 0;
    const total = +(exclTotal + tax + further + extra + fed - discount).toFixed(2);
    return { ...next, salesTaxApplicable: String(tax), totalValues: String(total) };
  }

  function setAndRecalc<K extends keyof ItemFormState>(key: K, value: string) {
    onChange(index, recalcTax({ ...item, [key]: value }));
  }

  const lineTotal = parseFloat(item.totalValues || "0") || 0;

  return (
    <div className="item-card">
      <div className="item-card-head">
        <div className="item-badge">{index + 1}</div>
        <strong className="item-title">
          {item.productDescription?.trim() || "New item"}
        </strong>
        <span className="item-total-chip">Rs {money(lineTotal)}</span>
        {canRemove && (
          <button
            type="button"
            className="icon-btn danger"
            title="Remove item"
            onClick={() => onRemove(index)}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M6 6l8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="subsection-label">Product</div>
      <div className="grid grid-3">
        <div className="field">
          <label>HS Code *</label>
          <Combobox
            value={item.hsCode}
            options={hsCodes}
            onChange={(v) => set("hsCode", v)}
            placeholder="Search HS code…"
            ariaLabel="HS Code"
          />
        </div>
        <div className="field field-wide">
          <label>Product description *</label>
          <input
            value={item.productDescription}
            onChange={(e) => set("productDescription", e.target.value)}
            placeholder="What was sold"
          />
        </div>
        <div className="field">
          <label>Sale type *</label>
          <Combobox
            value={item.saleType}
            options={saleTypes}
            onChange={(v) => set("saleType", v)}
            placeholder="Search sale type…"
            ariaLabel="Sale type"
          />
        </div>
        <div className="field">
          <label>UoM *</label>
          <Combobox
            value={item.uoM}
            options={uoms}
            onChange={(v) => set("uoM", v)}
            placeholder="Search unit…"
            ariaLabel="Unit of measure"
          />
        </div>
        <div className="field">
          <label>Quantity *</label>
          <input
            type="number"
            step="any"
            value={item.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </div>
      </div>

      <div className="subsection-label">Pricing &amp; tax</div>
      <div className="grid grid-3">
        <div className="field">
          <label>Rate *</label>
          <Combobox
            value={item.rate}
            options={rates}
            onChange={(v) => setAndRecalc("rate", v)}
            placeholder="e.g. 18%"
            ariaLabel="Tax rate"
          />
        </div>
        <div className="field">
          <label>Value excl. sales tax *</label>
          <input
            type="number"
            step="any"
            value={item.valueSalesExcludingST}
            onChange={(e) => setAndRecalc("valueSalesExcludingST", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Sales tax applicable *</label>
          <input
            type="number"
            step="any"
            value={item.salesTaxApplicable}
            onChange={(e) => set("salesTaxApplicable", e.target.value)}
          />
          <div className="hint">Auto from value &times; rate; editable.</div>
        </div>
        <div className="field">
          <label>Further tax</label>
          <input
            type="number"
            step="any"
            value={item.furtherTax}
            onChange={(e) => setAndRecalc("furtherTax", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Extra tax</label>
          <input
            type="number"
            step="any"
            value={item.extraTax}
            onChange={(e) => setAndRecalc("extraTax", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Discount</label>
          <input
            type="number"
            step="any"
            value={item.discount}
            onChange={(e) => setAndRecalc("discount", e.target.value)}
          />
        </div>
        <div className="field field-total">
          <label>Total value (incl. tax) *</label>
          <input
            type="number"
            step="any"
            value={item.totalValues}
            onChange={(e) => set("totalValues", e.target.value)}
          />
        </div>
      </div>

      <details className="advanced">
        <summary>Advanced fields</summary>
        <div className="grid grid-3">
          <div className="field">
            <label>FED payable</label>
            <input
              type="number"
              step="any"
              value={item.fedPayable}
              onChange={(e) => setAndRecalc("fedPayable", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Sales tax withheld at source</label>
            <input
              type="number"
              step="any"
              value={item.salesTaxWithheldAtSource}
              onChange={(e) => set("salesTaxWithheldAtSource", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Fixed notified / retail price</label>
            <input
              type="number"
              step="any"
              value={item.fixedNotifiedValueOrRetailPrice}
              onChange={(e) => set("fixedNotifiedValueOrRetailPrice", e.target.value)}
            />
          </div>
          <div className="field">
            <label>SRO schedule no</label>
            <input value={item.sroScheduleNo} onChange={(e) => set("sroScheduleNo", e.target.value)} />
          </div>
          <div className="field">
            <label>SRO item serial no</label>
            <input
              value={item.sroItemSerialNo}
              onChange={(e) => set("sroItemSerialNo", e.target.value)}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
