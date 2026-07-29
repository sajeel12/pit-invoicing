// GET a single logged invoice plus a QR code (data URL) for printing.
// The QR encodes the FBR invoice number so it can be scanned/verified.

import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getInvoice } from "@/lib/invoiceLog";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoiceNumber: string }> },
) {
  const { invoiceNumber } = await ctx.params;
  const invoice = await getInvoice(decodeURIComponent(invoiceNumber));
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  // FBR's spec (Section 6) fixes the QR FORMAT (v2.0, 25x25, 1x1 inch) but not its
  // data content. The de-facto FBR convention — what the Tax Asaan "Verify Invoice"
  // scanner and other integrators use — is the FBR Invoice Number plus the key
  // identifying fields (seller NTN, invoice date). We encode those as compact
  // key:value lines so the app reads the number and a human scan shows context.
  const qrLines = [
    `FBR Invoice No: ${invoice.invoiceNumber}`,
    `Seller NTN: ${invoice.payload?.sellerNTNCNIC ?? ""}`,
    `Date: ${invoice.payload?.invoiceDate ?? invoice.dated}`,
    `Verify: FBR Tax Asaan app or SMS 9966`,
  ];
  const qrPayload = qrLines.join("\n");

  // Printed at 1x1 inch; rendered at high resolution so it stays crisp.
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 600,
  });

  return NextResponse.json({ invoice, qrDataUrl });
}
