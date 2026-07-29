// GET proxy for PRAL reference (lookup) APIs. The browser calls
// /api/ref/provinces, /api/ref/uom, /api/ref/SaleTypeToRate?date=..&transTypeId=..&originationSupplier=..
// and we forward to FBR with the Bearer token attached. Solves CORS + keeps token secret.

import { NextRequest, NextResponse } from "next/server";
import { fbrGet, FbrError } from "@/lib/fbr";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> },
) {
  const { resource } = await ctx.params;
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  try {
    const data = await fbrGet(resource, query);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FbrError) {
      return NextResponse.json(
        { error: err.message, detail: err.body ?? null },
        { status: err.status || 502 },
      );
    }
    return NextResponse.json(
      { error: "Unexpected error contacting FBR." },
      { status: 502 },
    );
  }
}
