// POST an invoice to FBR's validate endpoint. Returns the FBR validation
// response unchanged so the form can show statusCode / errors per item.
// Validation does NOT issue an invoice number — use /api/submit for that.

import { NextRequest, NextResponse } from "next/server";
import { fbrPost, validateInvoiceUrl, getEnv, FbrError } from "@/lib/fbr";
import { buildPayload } from "@/lib/payload";
import { runServerPreflight } from "@/lib/preflightServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const env = getEnv();
    // Preflight is the gate: block bad invoices before FBR is called.
    const { blocked, result } = await runServerPreflight(body as Record<string, unknown>, env);
    if (blocked) return blocked;

    const payload = buildPayload(result.filledBody, env);
    const data = await fbrPost(validateInvoiceUrl(env), payload);
    return NextResponse.json({
      ...(data as object),
      _preflight: { warnings: result.issues.filter((i) => i.severity === "warning"), fills: result.fills },
    });
  } catch (err) {
    if (err instanceof FbrError) {
      return NextResponse.json(
        { error: err.message, detail: err.body ?? null },
        { status: err.status || 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error." },
      { status: 400 },
    );
  }
}
