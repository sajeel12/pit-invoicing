// POST an invoice to FBR's post endpoint. On a valid response (statusCode 00),
// append a record to the local invoice log. Returns the FBR response to the form.

import { NextRequest, NextResponse } from "next/server";
import { fbrPost, postInvoiceUrl, getEnv, FbrError } from "@/lib/fbr";
import { buildPayload } from "@/lib/payload";
import { appendInvoice } from "@/lib/invoiceLog";
import { runServerPreflight } from "@/lib/preflightServer";
import type { FbrInvoiceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let env: ReturnType<typeof getEnv>;
  let data: FbrInvoiceResponse;
  let payload: ReturnType<typeof buildPayload>;
  try {
    env = getEnv();
    // Preflight is the real gate: refuse a bad invoice before issuing a number.
    const { blocked, result } = await runServerPreflight(body as Record<string, unknown>, env);
    if (blocked) return blocked;
    body = result.filledBody; // use auto-filled body for logging + payload
    payload = buildPayload(result.filledBody, env);
    data = (await fbrPost(postInvoiceUrl(env), payload)) as FbrInvoiceResponse;
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

  // Log only successfully issued invoices.
  if (data?.validationResponse?.statusCode === "00" && data.invoiceNumber) {
    const r = body as Record<string, unknown>;
    const items = Array.isArray(r.items) ? r.items : [];
    const total = items.reduce(
      (sum: number, it: Record<string, unknown>) =>
        sum + (parseFloat(String(it.totalValues ?? "")) || 0),
      0,
    );
    try {
      await appendInvoice({
        invoiceNumber: data.invoiceNumber,
        dated: data.dated ?? "",
        invoiceType: r.invoiceType === "Debit Note" ? "Debit Note" : "Sale Invoice",
        buyerBusinessName: String(r.buyerBusinessName ?? ""),
        buyerNTNCNIC: String(r.buyerNTNCNIC ?? "") || undefined,
        total,
        scenarioId: String(r.scenarioId ?? "") || undefined,
        env,
        submittedAt: new Date().toISOString(),
        rawResponse: data,
        payload,
      });
    } catch {
      // Logging failure shouldn't hide a successful submission; surface a flag.
      return NextResponse.json({ ...data, _logWarning: "Invoice submitted but could not be written to local log." });
    }
  }

  return NextResponse.json(data);
}
