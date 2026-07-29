// Server-side FBR/PRAL client. Runs only in API route handlers so the Bearer
// token (FBR_TOKEN) never reaches the browser. Endpoints and field semantics
// are from the PRAL DI API spec v1.12.

import "server-only";

export type FbrEnv = "sandbox" | "production";

export function getEnv(): FbrEnv {
  return process.env.FBR_ENV === "production" ? "production" : "sandbox";
}

export function getToken(): string {
  const token = process.env.FBR_TOKEN;
  if (!token) {
    throw new FbrError(
      "FBR_TOKEN is not set. Copy .env.local.example to .env.local and add your PRAL token.",
      0,
    );
  }
  return token;
}

export function getSellerDefaults() {
  return {
    sellerNTNCNIC: process.env.SELLER_NTNCNIC ?? "",
    sellerBusinessName: process.env.SELLER_BUSINESS_NAME ?? "",
    sellerProvince: process.env.SELLER_PROVINCE ?? "",
    sellerAddress: process.env.SELLER_ADDRESS ?? "",
  };
}

// Same host/path for sandbox and production; only the path suffix differs.
// Routing to the right environment is ultimately decided by the token used.
const DI_BASE = "https://gw.fbr.gov.pk/di_data/v1/di";
const PDI_BASE = "https://gw.fbr.gov.pk/pdi";

export function postInvoiceUrl(env: FbrEnv): string {
  return env === "production"
    ? `${DI_BASE}/postinvoicedata`
    : `${DI_BASE}/postinvoicedata_sb`;
}

export function validateInvoiceUrl(env: FbrEnv): string {
  return env === "production"
    ? `${DI_BASE}/validateinvoicedata`
    : `${DI_BASE}/validateinvoicedata_sb`;
}

// Reference (lookup) APIs. Keys are the `resource` slugs used by /api/ref/[resource].
// Values that need query params accept them via the `query` arg of fbrGet().
export const REFERENCE_URLS: Record<string, string> = {
  provinces: `${PDI_BASE}/v1/provinces`,
  doctypecode: `${PDI_BASE}/v1/doctypecode`,
  itemdesccode: `${PDI_BASE}/v1/itemdesccode`,
  sroitemcode: `${PDI_BASE}/v1/sroitemcode`,
  transtypecode: `${PDI_BASE}/v1/transtypecode`,
  uom: `${PDI_BASE}/v1/uom`,
  SroSchedule: `${PDI_BASE}/v1/SroSchedule`,
  SaleTypeToRate: `${PDI_BASE}/v2/SaleTypeToRate`,
  HS_UOM: `${PDI_BASE}/v2/HS_UOM`,
  SROItem: `${PDI_BASE}/v2/SROItem`,
};

export class FbrError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "FbrError";
    this.status = status;
    this.body = body;
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    // Ask for an uncompressed body so Node's fetch can't mis-decode a
    // mislabelled gzip/br response into garbage that fails JSON.parse.
    "Accept-Encoding": "identity",
  };
}

function describeHttp(status: number): string {
  if (status === 401) return "Unauthorized — FBR token is missing, invalid, or expired.";
  if (status === 500) return "FBR server error — try again shortly.";
  return `FBR returned HTTP ${status}.`;
}

async function parseJson(res: Response): Promise<unknown> {
  const raw = await res.text();
  const text = raw.trim();
  if (!res.ok) {
    throw new FbrError(describeHttp(res.status), res.status, text);
  }
  if (!text) {
    throw new FbrError(
      "FBR returned an empty response. The sandbox sometimes does this under load — please retry.",
      res.status,
      raw,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    // FBR sometimes returns technically-malformed JSON with trailing commas
    // before } or ] (e.g. ...},  }). Strip those and retry before giving up.
    try {
      const repaired = text.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(repaired);
    } catch {
      // Include a snippet of what came back so the cause is visible (e.g. an HTML
      // gateway error page) instead of an opaque "non-JSON" message.
      const snippet = text.slice(0, 300);
      throw new FbrError(
        `FBR returned a non-JSON response: ${snippet}`,
        res.status,
        raw,
      );
    }
  }
}

export async function fbrPost(url: string, payload: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return parseJson(res);
}

export async function fbrGet(
  resource: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const base = REFERENCE_URLS[resource];
  if (!base) {
    throw new FbrError(`Unknown reference resource "${resource}".`, 400);
  }
  const url = new URL(base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  return parseJson(res);
}
