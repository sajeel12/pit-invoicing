// Server-side Fetcher for the rules engine: calls FBR directly (token stays
// server-side) with a process-level TTL cache so reference data — especially the
// ~7,800-row HS list — isn't re-fetched on every submit. Keyed by resource+params.

import "server-only";
import { fbrGet } from "./fbr";
import type { Fetcher } from "./rules";

const TTL_MS = 60 * 60 * 1000; // 1 hour; reference data changes rarely
const cache = new Map<string, { at: number; data: unknown }>();

function key(resource: string, params?: Record<string, string>): string {
  return (
    resource +
    "?" +
    Object.entries(params ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  );
}

export const serverFetcher: Fetcher = async (resource, params) => {
  const k = key(resource, params);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fbrGet(resource, params);
  cache.set(k, { at: Date.now(), data });
  return data;
};
