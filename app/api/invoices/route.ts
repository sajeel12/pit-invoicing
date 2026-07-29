// GET the local invoice log (newest first) for the /history page.

import { NextResponse } from "next/server";
import { readInvoices } from "@/lib/invoiceLog";

export const dynamic = "force-dynamic";

export async function GET() {
  const invoices = await readInvoices();
  return NextResponse.json(invoices);
}
