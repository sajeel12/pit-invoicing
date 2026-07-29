// Server-side preflight gate shared by /api/validate and /api/submit. Runs the
// rules with the direct-FBR fetcher and, on any ERROR-severity issue, blocks the
// request with HTTP 400 before FBR is ever called. This is the real gate: a
// buggy or hostile client cannot file garbage past it.

import "server-only";
import { NextResponse } from "next/server";
import { createRules } from "./rules";
import { serverFetcher } from "./serverFetcher";
import { preflight, hasErrors, type PreflightResult } from "./preflight";
import type { FbrEnv } from "./fbr";

export interface Preflighted {
  blocked: NextResponse | null;
  result: PreflightResult;
}

export async function runServerPreflight(
  body: Record<string, unknown>,
  env: FbrEnv,
): Promise<Preflighted> {
  const rules = createRules(serverFetcher);
  const result = await preflight(body, rules, { sandbox: env === "sandbox" });
  if (hasErrors(result)) {
    return {
      blocked: NextResponse.json(
        {
          error: "Preflight validation failed — invoice not sent to FBR.",
          issues: result.issues,
        },
        { status: 400 },
      ),
      result,
    };
  }
  return { blocked: null, result };
}
