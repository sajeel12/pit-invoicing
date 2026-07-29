// Reads an FBR post/validate response into a plain result. FBR usually puts the
// real reason in the per-item status array (invoiceStatuses[].error), not the
// top-level error — so we surface item-level messages first, then top-level.

import type { FbrInvoiceResponse } from "./types";

export interface ReadResult {
  valid: boolean;
  invoiceNumber?: string;
  messages: string[]; // human-readable reasons, item-level first
}

export function readFbrResponse(resp: FbrInvoiceResponse | undefined): ReadResult {
  const vr = resp?.validationResponse;
  if (!vr) return { valid: false, messages: ["Unexpected response from FBR."] };

  if (vr.statusCode === "00") {
    return { valid: true, invoiceNumber: resp?.invoiceNumber, messages: [] };
  }

  const messages: string[] = [];
  for (const s of vr.invoiceStatuses ?? []) {
    if (s.statusCode !== "00" && s.error) {
      messages.push(`Item ${s.itemSNo}: ${s.errorCode ? s.errorCode + " — " : ""}${s.error}`);
    }
  }
  if (vr.error) {
    messages.push(`${vr.errorCode ? vr.errorCode + ": " : ""}${vr.error}`);
  }
  return {
    valid: false,
    messages: messages.length ? messages : ["FBR rejected the invoice (no detail provided)."],
  };
}
