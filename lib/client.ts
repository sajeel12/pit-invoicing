// Browser-side helpers that talk to our own /api/* routes (never FBR directly).

import { createRules, type Rules } from "./rules";

export interface RefOption {
  value: string;
  label: string;
  raw?: Record<string, unknown>;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchRef(
  resource: string,
  query?: Record<string, string>,
): Promise<unknown> {
  const qs = query
    ? "?" + new URLSearchParams(query).toString()
    : "";
  return getJson(`/api/ref/${resource}${qs}`);
}

// A rules engine wired to the browser fetcher (hits our /api/ref proxy). One
// instance per form session gives a session-lived reference-data cache.
export function clientRules(): Rules {
  return createRules(fetchRef);
}

export interface AppConfig {
  env: "sandbox" | "production";
  seller: {
    sellerNTNCNIC: string;
    sellerBusinessName: string;
    sellerProvince: string;
    sellerAddress: string;
  };
}

export async function fetchConfig(): Promise<AppConfig> {
  return getJson("/api/config") as Promise<AppConfig>;
}

export async function postInvoice(
  kind: "validate" | "submit",
  payload: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
