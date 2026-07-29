// Strict numeric parsing. FBR rejects negative/null/empty/string numerics
// (error 0300), and naive parseFloat turns "1,000" into 1 and "Rs 1,000" into
// NaN/1 — silently corrupting a filed invoice. So we REFUSE anything ambiguous
// with a clear message instead of guessing.

export type NumberParse =
  | { ok: true; value: number }
  | { ok: false; reason: string };

// Accepts an already-numeric value, or a plain decimal string like "1000" or
// "1000.50". Everything else (commas, currency, spaces, letters) is refused.
export function parseStrictNumber(input: unknown, { allowNegative = false } = {}): NumberParse {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return { ok: false, reason: "Value is not a finite number." };
    if (!allowNegative && input < 0) return { ok: false, reason: "Value must not be negative." };
    return { ok: true, value: input };
  }
  if (typeof input !== "string") {
    return { ok: false, reason: "Value must be a number." };
  }

  const s = input.trim();
  if (s === "") return { ok: false, reason: "Value is empty." };

  if (s.includes(",")) {
    return {
      ok: false,
      reason: `Remove the comma — type the plain number, e.g. "${s.replace(/,/g, "")}".`,
    };
  }
  if (/[^\d.\-]/.test(s)) {
    // currency symbols, letters, spaces, etc.
    const cleaned = s.replace(/[^\d.\-]/g, "");
    return {
      ok: false,
      reason: `Type only the number (no symbols or letters)${
        cleaned ? `, e.g. "${cleaned}"` : ""
      }.`,
    };
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return { ok: false, reason: `"${s}" is not a valid number.` };
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, reason: `"${s}" is not a valid number.` };
  if (!allowNegative && value < 0) return { ok: false, reason: "Value must not be negative." };
  return { ok: true, value };
}

// Parse a percentage rate string like "18%" -> 18. Returns null if not a plain
// percentage (some FBR rates are descriptive, e.g. "50/SqY" or "Exempt").
export function parseRatePercent(rate: string): number | null {
  const m = rate.trim().match(/^([\d.]+)\s*%$/);
  return m ? parseFloat(m[1]) : null;
}

// True when two money amounts agree within a small tolerance (rounding slack).
export function approxEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}
