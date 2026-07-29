// Exposes non-secret config to the client: which environment we're in (so the
// form can show/hide the scenarioId field) and the seller defaults to prefill.
// Never returns the token.

import { NextResponse } from "next/server";
import { getEnv, getSellerDefaults } from "@/lib/fbr";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    env: getEnv(),
    seller: getSellerDefaults(),
  });
}
