import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeliveredStore } from "../types.js";
import { normalizeUrl } from "./links.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DELIVERED_PATH = join(__dirname, "../../data/delivered.json");

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function loadDelivered(): DeliveredStore {
  if (!existsSync(DELIVERED_PATH)) {
    return { entries: [] };
  }
  const raw = readFileSync(DELIVERED_PATH, "utf-8");
  const parsed = JSON.parse(raw) as DeliveredStore;
  const now = Date.now();
  const entries = (parsed.entries ?? []).filter((e) => {
    const t = Date.parse(e.deliveredAt);
    return !Number.isNaN(t) && now - t < RETENTION_MS;
  });
  return { entries };
}

export function isUrlDelivered(store: DeliveredStore, url: string): boolean {
  const n = normalizeUrl(url);
  return store.entries.some((e) => normalizeUrl(e.url) === n);
}

export function filterNewArticles<T extends { url: string }>(
  store: DeliveredStore,
  articles: T[]
): T[] {
  return articles.filter((a) => !isUrlDelivered(store, a.url));
}

export function appendDelivered(store: DeliveredStore, urls: string[], deliveredAt: Date): void {
  const at = deliveredAt.toISOString();
  const seen = new Set(store.entries.map((e) => normalizeUrl(e.url)));
  for (const url of urls) {
    const n = normalizeUrl(url);
    if (seen.has(n)) continue;
    seen.add(n);
    store.entries.push({ url, deliveredAt: at });
  }
}

export function saveDelivered(store: DeliveredStore): void {
  writeFileSync(DELIVERED_PATH, JSON.stringify({ entries: store.entries }, null, 2) + "\n", "utf-8");
}
