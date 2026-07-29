// Shared FBR dependency-rule engine. Runs in BOTH the browser (fetcher hits our
// /api/ref proxy) and the server (fetcher calls FBR directly). Therefore this
// module must NOT statically import any server-only / credential code — the data
// source is injected as `fetcher`.
//
// Every lookup returns an explicit three-state result so callers never confuse
// "FBR imposes no constraint" with "the lookup failed and we can't judge":
//   restricted   -> FBR allows only these options
//   unrestricted -> no constraint on this field
//   unknown      -> the lookup failed; caller decides fail-open vs fail-closed

import { SCENARIOS } from "./scenarios";

export type Fetcher = (
  resource: string,
  params?: Record<string, string>,
) => Promise<unknown>;

export type LookupResult =
  | { status: "restricted"; options: string[] }
  | { status: "unrestricted" }
  | { status: "unknown"; reason: string };

// Normalise a description for matching: trim, collapse inner whitespace, lower.
// FBR's transtypecode descriptions have irregular casing/padding (e.g.
// " 3rd Schedule Goods ", " Services "), so matching must be tolerant.
function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

// FBR's SaleTypeToRate requires an English dd-Mon-yyyy date. Building it with the
// system locale can silently yield a non-English month (e.g. Urdu), which makes
// the API return nothing. Force en-GB.
export function fbrDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(d)
    .replace(/ /g, "-");
}

// Default originationSupplier for the rate lookup. The seller's province code is
// used when it can be resolved (services rates are province-specific); this is
// the fallback the FBR examples use and which returns national rates.
const DEFAULT_ORIGINATION = "1";

export function createRules(fetcher: Fetcher) {
  // Per-instance cache. Caches the PROMISE (so concurrent identical calls
  // coalesce) and evicts on rejection (so a transient failure doesn't poison a
  // whole batch). Keyed by resource + sorted params.
  const cache = new Map<string, Promise<unknown>>();

  function get(resource: string, params?: Record<string, string>): Promise<unknown> {
    const key =
      resource +
      "?" +
      Object.entries(params ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    const hit = cache.get(key);
    if (hit) return hit;
    const p = fetcher(resource, params).catch((e) => {
      cache.delete(key); // evict on rejection
      throw e;
    });
    cache.set(key, p);
    return p;
  }

  function asArray(data: unknown): Record<string, unknown>[] | null {
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : null;
  }

  // ---- Static rule: which sale type a sandbox scenario expects ----
  function saleTypeForScenario(scenarioId: string): string | null {
    return SCENARIOS.find((s) => s.id === scenarioId)?.saleType ?? null;
  }

  // ---- provinces -> valid province descriptions ----
  async function provinces(): Promise<LookupResult> {
    try {
      const rows = asArray(await get("provinces"));
      if (!rows) return { status: "unknown", reason: "Provinces lookup returned no array." };
      const options = rows
        .map((r) => String(r.stateProvinceDesc ?? "").trim())
        .filter(Boolean);
      return options.length ? { status: "restricted", options } : { status: "unrestricted" };
    } catch (e) {
      return { status: "unknown", reason: msg(e) };
    }
  }

  // Resolve a province NAME to its numeric code (for the rate lookup).
  async function provinceCode(name: string): Promise<string | null> {
    if (!name) return null;
    try {
      const rows = asArray(await get("provinces"));
      if (!rows) return null;
      const hit = rows.find((r) => norm(String(r.stateProvinceDesc ?? "")) === norm(name));
      return hit ? String(hit.stateProvinceCode) : null;
    } catch {
      return null;
    }
  }

  // ---- itemdesccode -> is this HS code known? (full list, cached once) ----
  async function hsCodeSet(): Promise<Set<string> | null> {
    try {
      const rows = asArray(await get("itemdesccode"));
      if (!rows) return null;
      return new Set(rows.map((r) => String(r.hS_CODE ?? r.hs_code ?? "").trim()).filter(Boolean));
    } catch {
      return null;
    }
  }

  async function hsCodeValid(hsCode: string): Promise<LookupResult> {
    const set = await hsCodeSet();
    if (!set) return { status: "unknown", reason: "HS-code list unavailable." };
    return set.has(hsCode.trim())
      ? { status: "unrestricted" } // known & valid — no further constraint here
      : { status: "restricted", options: [] }; // empty options => not a member
  }

  // ---- HS_UOM -> valid unit(s) for an HS code ----
  async function unitsForHs(hsCode: string): Promise<LookupResult> {
    if (!hsCode.trim()) return { status: "unrestricted" };
    try {
      const rows = asArray(
        await get("HS_UOM", { hs_code: hsCode.trim(), annexure_id: "3" }),
      );
      if (!rows) return { status: "unknown", reason: "Unit lookup returned no array." };
      const options = rows.map((r) => String(r.description ?? "").trim()).filter(Boolean);
      // Empty AFTER confirmed field names/params => treat as no constraint, not a
      // failure (some HS codes legitimately return no UoM restriction).
      return options.length ? { status: "restricted", options } : { status: "unrestricted" };
    } catch (e) {
      return { status: "unknown", reason: msg(e) };
    }
  }

  // ---- transtypecode -> transaction-type id for a sale type (runtime map) ----
  async function transTypeId(saleType: string): Promise<string | null> {
    if (!saleType.trim()) return null;
    try {
      const rows = asArray(await get("transtypecode"));
      if (!rows) return null;
      const target = norm(saleType);
      const hit = rows.find((r) => norm(String(r.transactioN_DESC ?? "")) === target);
      return hit ? String(hit.transactioN_TYPE_ID) : null;
    } catch {
      return null;
    }
  }

  // ---- SaleTypeToRate -> valid rate(s) for a sale type + province ----
  async function ratesForSaleType(
    saleType: string,
    provinceName?: string,
    date: Date = new Date(),
  ): Promise<LookupResult> {
    if (!saleType.trim()) return { status: "unrestricted" };
    const transId = await transTypeId(saleType);
    if (!transId) {
      // Sale type not in the map => we can't derive its rate; caller decides.
      return { status: "unknown", reason: `No transaction-type id for sale type "${saleType}".` };
    }
    const origination = (provinceName && (await provinceCode(provinceName))) || DEFAULT_ORIGINATION;
    try {
      const rows = asArray(
        await get("SaleTypeToRate", {
          date: fbrDate(date),
          transTypeId: transId,
          originationSupplier: origination,
        }),
      );
      if (!rows) return { status: "unknown", reason: "Rate lookup returned no array." };
      const options = rows.map((r) => String(r.ratE_DESC ?? "").trim()).filter(Boolean);
      return options.length
        ? { status: "restricted", options }
        : { status: "unknown", reason: "Rate lookup returned empty (check date/params)." };
    } catch (e) {
      return { status: "unknown", reason: msg(e) };
    }
  }

  return {
    saleTypeForScenario,
    provinces,
    provinceCode,
    hsCodeValid,
    unitsForHs,
    transTypeId,
    ratesForSaleType,
  };
}

export type Rules = ReturnType<typeof createRules>;

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "lookup failed";
}
