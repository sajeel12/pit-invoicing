// Normalises raw form data into the exact JSON shape FBR expects:
//  - coerces numeric item fields to numbers
//  - drops scenarioId in production (it must NOT be sent live)
//  - omits empty optional fields and empty buyerNTNCNIC for Unregistered buyers
// Shared by /api/validate and /api/submit.

import type { FbrEnv } from "./fbr";
import type { InvoicePayload, InvoiceItem } from "./types";

const NUMERIC_ITEM_FIELDS = [
  "quantity",
  "totalValues",
  "valueSalesExcludingST",
  "fixedNotifiedValueOrRetailPrice",
  "salesTaxApplicable",
  "salesTaxWithheldAtSource",
  "extraTax",
  "furtherTax",
  "fedPayable",
  "discount",
] as const;

const OPTIONAL_ITEM_STRINGS = ["sroScheduleNo", "sroItemSerialNo"] as const;

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function cleanItem(raw: Record<string, unknown>): InvoiceItem {
  const item: Record<string, unknown> = {
    hsCode: String(raw.hsCode ?? "").trim(),
    productDescription: String(raw.productDescription ?? "").trim(),
    rate: String(raw.rate ?? "").trim(),
    uoM: String(raw.uoM ?? "").trim(),
    saleType: String(raw.saleType ?? "").trim(),
  };

  for (const field of NUMERIC_ITEM_FIELDS) {
    if (raw[field] !== undefined && raw[field] !== "" && raw[field] !== null) {
      item[field] = toNumber(raw[field]);
    }
  }
  // Required numeric fields must always be present (default 0).
  item.quantity = toNumber(raw.quantity);
  item.totalValues = toNumber(raw.totalValues);
  item.valueSalesExcludingST = toNumber(raw.valueSalesExcludingST);
  item.fixedNotifiedValueOrRetailPrice = toNumber(raw.fixedNotifiedValueOrRetailPrice);
  item.salesTaxApplicable = toNumber(raw.salesTaxApplicable);
  item.salesTaxWithheldAtSource = toNumber(raw.salesTaxWithheldAtSource);

  for (const field of OPTIONAL_ITEM_STRINGS) {
    const val = String(raw[field] ?? "").trim();
    if (val) item[field] = val;
  }

  return item as unknown as InvoiceItem;
}

export function buildPayload(raw: unknown, env: FbrEnv): InvoicePayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Missing invoice data.");
  }
  const r = raw as Record<string, unknown>;

  const rawItems = Array.isArray(r.items) ? r.items : [];
  if (rawItems.length === 0) {
    throw new Error("At least one invoice item is required.");
  }

  const buyerRegistrationType =
    r.buyerRegistrationType === "Unregistered" ? "Unregistered" : "Registered";

  const payload: InvoicePayload = {
    invoiceType: r.invoiceType === "Debit Note" ? "Debit Note" : "Sale Invoice",
    invoiceDate: String(r.invoiceDate ?? "").trim(),
    sellerNTNCNIC: String(r.sellerNTNCNIC ?? "").trim(),
    sellerBusinessName: String(r.sellerBusinessName ?? "").trim(),
    sellerProvince: String(r.sellerProvince ?? "").trim(),
    sellerAddress: String(r.sellerAddress ?? "").trim(),
    buyerBusinessName: String(r.buyerBusinessName ?? "").trim(),
    buyerProvince: String(r.buyerProvince ?? "").trim(),
    buyerAddress: String(r.buyerAddress ?? "").trim(),
    buyerRegistrationType,
    items: rawItems.map((it) => cleanItem(it as Record<string, unknown>)),
  };

  // buyerNTNCNIC: required for Registered. For Unregistered, FBR still rejects an
  // empty value (error 0002) and expects the placeholder NTN 1000000000000, as in
  // the spec's own sample. So fall back to that placeholder when unregistered.
  const buyerNtn = String(r.buyerNTNCNIC ?? "").trim();
  if (buyerNtn) {
    payload.buyerNTNCNIC = buyerNtn;
  } else if (buyerRegistrationType === "Unregistered") {
    payload.buyerNTNCNIC = "1000000000000";
  }

  // invoiceRefNo: required only for Debit Note; include if present.
  const refNo = String(r.invoiceRefNo ?? "").trim();
  if (refNo) payload.invoiceRefNo = refNo;

  // scenarioId: sandbox only. Never send it in production.
  if (env === "sandbox") {
    const scenarioId = String(r.scenarioId ?? "").trim();
    if (scenarioId) payload.scenarioId = scenarioId;
  }

  return payload;
}
