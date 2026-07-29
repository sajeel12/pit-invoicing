// Preflight validation: run every FBR dependency rule locally BEFORE calling
// FBR, so mistakes are caught per-field instantly instead of as a cryptic FBR
// rejection. Pure orchestration over lib/rules + lib/numbers — no UI, no network
// of its own (the fetcher is baked into the injected `rules`).
//
// Policy (interactive form): block on ERRORs, never block on WARNINGs. Unknown
// lookups fail OPEN (warn, don't block) — FBR's own validate is the backstop.
// Blanks with exactly one valid value are auto-filled; a wrong typed value is
// reported as an error, never silently rewritten.

import type { Rules } from "./rules";
import { parseStrictNumber, parseRatePercent, approxEqual } from "./numbers";

export type Severity = "error" | "warning";

export interface PreflightIssue {
  row?: number; // 1-based item index; omitted for header-level issues
  field: string;
  message: string;
  severity: Severity;
}

export interface Fill {
  row: number;
  field: "rate" | "uoM";
  value: string;
  note: string;
}

export interface PreflightResult {
  issues: PreflightIssue[];
  fills: Fill[];
  // A shallow copy of the body with blanks auto-filled where exactly one valid
  // value existed. Callers send this (form applies it to state; server posts it).
  filledBody: Record<string, unknown>;
}

interface Options {
  sandbox: boolean;
  date?: Date;
}

const REQUIRED_NUMERIC = [
  "quantity",
  "valueSalesExcludingST",
  "salesTaxApplicable",
  "totalValues",
  "fixedNotifiedValueOrRetailPrice",
  "salesTaxWithheldAtSource",
] as const;
const OPTIONAL_NUMERIC = ["furtherTax", "extraTax", "fedPayable", "discount"] as const;

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function preflight(
  body: Record<string, unknown>,
  rules: Rules,
  opts: Options,
): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const fills: Fill[] = [];
  const date = opts.date ?? new Date();

  // Work on a clone so auto-fills don't mutate the caller's object.
  const filled: Record<string, unknown> = { ...body };
  const items: Record<string, unknown>[] = Array.isArray(body.items)
    ? (body.items as Record<string, unknown>[]).map((it) => ({ ...it }))
    : [];
  filled.items = items;

  if (items.length === 0) {
    issues.push({ field: "items", message: "At least one item is required.", severity: "error" });
  }

  // ---- Header: province validity (seller + buyer) ----
  const provResult = await rules.provinces();
  for (const [field, label] of [
    ["sellerProvince", "Seller province"],
    ["buyerProvince", "Buyer province"],
  ] as const) {
    const val = str(body[field]).trim();
    if (!val) {
      issues.push({ field, message: `${label} is required.`, severity: "error" });
      continue;
    }
    if (provResult.status === "restricted") {
      const ok = provResult.options.some((o) => norm(o) === norm(val));
      if (!ok) {
        issues.push({
          field,
          message: `${label} "${val}" is not a valid FBR province.`,
          severity: "error",
        });
      }
    } else if (provResult.status === "unknown") {
      issues.push({
        field,
        message: `Could not verify ${label.toLowerCase()} (lookup failed): ${provResult.reason}`,
        severity: "warning",
      });
    }
  }

  const scenarioId = str(body.scenarioId).trim();
  const expectedSaleType = opts.sandbox && scenarioId ? rules.saleTypeForScenario(scenarioId) : null;

  // ---- Items ----
  for (let i = 0; i < items.length; i++) {
    const row = i + 1;
    const it = items[i];

    // Strict numeric parsing.
    for (const f of REQUIRED_NUMERIC) {
      const raw = it[f];
      if (raw === undefined || raw === null || str(raw).trim() === "") {
        issues.push({ row, field: f, message: `${f} is required.`, severity: "error" });
        continue;
      }
      const p = parseStrictNumber(raw);
      if (!p.ok) issues.push({ row, field: f, message: p.reason, severity: "error" });
    }
    for (const f of OPTIONAL_NUMERIC) {
      const raw = it[f];
      if (raw === undefined || raw === null || str(raw).trim() === "") continue;
      const p = parseStrictNumber(raw);
      if (!p.ok) issues.push({ row, field: f, message: p.reason, severity: "error" });
    }

    const hsCode = str(it.hsCode).trim();
    if (!hsCode) {
      issues.push({ row, field: "hsCode", message: "HS code is required.", severity: "error" });
    } else {
      const hs = await rules.hsCodeValid(hsCode);
      if (hs.status === "restricted" && hs.options.length === 0) {
        issues.push({
          row,
          field: "hsCode",
          message: `HS code "${hsCode}" is not recognised by FBR.`,
          severity: "error",
        });
      } else if (hs.status === "unknown") {
        issues.push({
          row,
          field: "hsCode",
          message: `Could not verify HS code (lookup failed).`,
          severity: "warning",
        });
      }
    }

    // Sale type vs scenario (sandbox).
    const saleType = str(it.saleType).trim();
    if (expectedSaleType) {
      if (!saleType) {
        items[i].saleType = expectedSaleType; // auto-fill blank from scenario
      } else if (norm(saleType) !== norm(expectedSaleType)) {
        issues.push({
          row,
          field: "saleType",
          message: `Sale type must match scenario ${scenarioId}: "${expectedSaleType}".`,
          severity: "error",
        });
      }
    } else if (!saleType) {
      issues.push({ row, field: "saleType", message: "Sale type is required.", severity: "error" });
    }
    const effectiveSaleType = str(items[i].saleType).trim();

    // Unit vs HS code.
    if (hsCode) {
      const units = await rules.unitsForHs(hsCode);
      const uom = str(it.uoM).trim();
      if (units.status === "restricted") {
        if (!uom && units.options.length === 1) {
          items[i].uoM = units.options[0];
          fills.push({ row, field: "uoM", value: units.options[0], note: "only valid unit for this HS code" });
        } else if (!uom) {
          issues.push({ row, field: "uoM", message: `Choose a unit: ${units.options.join(", ")}.`, severity: "error" });
        } else if (!units.options.some((o) => norm(o) === norm(uom))) {
          issues.push({
            row,
            field: "uoM",
            message: `Unit "${uom}" is not valid for HS ${hsCode} → use: ${units.options.join(", ")}.`,
            severity: "error",
          });
        }
      } else if (!uom) {
        issues.push({ row, field: "uoM", message: "Unit is required.", severity: "error" });
      }
    }

    // Rate vs sale type (+ province). Money-sensitive.
    if (effectiveSaleType) {
      const rates = await rules.ratesForSaleType(effectiveSaleType, str(body.sellerProvince), date);
      const rate = str(it.rate).trim();
      if (rates.status === "restricted") {
        if (!rate && rates.options.length === 1) {
          items[i].rate = rates.options[0];
          fills.push({ row, field: "rate", value: rates.options[0], note: "only valid rate for this sale type" });
        } else if (!rate) {
          issues.push({ row, field: "rate", message: `Choose a rate: ${rates.options.join(", ")}.`, severity: "error" });
        } else if (!rates.options.some((o) => norm(o) === norm(rate))) {
          issues.push({
            row,
            field: "rate",
            message: `Rate "${rate}" is not valid for "${effectiveSaleType}" → allowed: ${rates.options.join(", ")}.`,
            severity: "error",
          });
        }
      } else if (rates.status === "unknown") {
        if (!rate) {
          issues.push({ row, field: "rate", message: "Rate is required.", severity: "error" });
        } else {
          issues.push({
            row,
            field: "rate",
            message: `Could not verify rate for "${effectiveSaleType}" (${rates.reason}).`,
            severity: "warning",
          });
        }
      } else if (!rate) {
        issues.push({ row, field: "rate", message: "Rate is required.", severity: "error" });
      }
    }

    // Arithmetic cross-check (warnings — user may override for special cases).
    arithmeticChecks(items[i], row, issues);
  }

  return { issues, fills, filledBody: filled };
}

function arithmeticChecks(it: Record<string, unknown>, row: number, issues: PreflightIssue[]) {
  const value = parseStrictNumber(it.valueSalesExcludingST);
  const tax = parseStrictNumber(it.salesTaxApplicable);
  const total = parseStrictNumber(it.totalValues);
  const pct = parseRatePercent(str(it.rate));
  if (!value.ok) return; // numeric errors already reported

  if (pct !== null && tax.ok) {
    const expected = +(value.value * (pct / 100)).toFixed(2);
    if (!approxEqual(tax.value, expected)) {
      issues.push({
        row,
        field: "salesTaxApplicable",
        message: `Sales tax ${tax.value} doesn't match ${pct}% of ${value.value} (≈ ${expected}).`,
        severity: "warning",
      });
    }
  }
  if (total.ok) {
    const further = num(it.furtherTax), extra = num(it.extraTax), fed = num(it.fedPayable), disc = num(it.discount);
    const t = tax.ok ? tax.value : 0;
    const expected = +(value.value + t + further + extra + fed - disc).toFixed(2);
    if (!approxEqual(total.value, expected)) {
      issues.push({
        row,
        field: "totalValues",
        message: `Total ${total.value} doesn't match value + taxes − discount (≈ ${expected}).`,
        severity: "warning",
      });
    }
  }
}

function num(v: unknown): number {
  const p = parseStrictNumber(v);
  return p.ok ? p.value : 0;
}

export function hasErrors(result: PreflightResult): boolean {
  return result.issues.some((i) => i.severity === "error");
}
