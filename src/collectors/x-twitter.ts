import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { CollectedArticle } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type XTwitterConfig = { handles?: string[] };

const MAX_PER_HANDLE = 8;
const MAX_TOTAL = 30;

function loadHandles(): string[] {
  const configPath = join(__dirname, "../config/x-twitter.yaml");
  const raw = readFileSync(configPath, "utf-8");
  const cfg = parseYaml(raw) as XTwitterConfig;
  return (cfg.handles ?? []).map((h) => h.replace(/^@/, "").trim()).filter(Boolean);
}

type UserByUsernameResp = { data?: { id: string; username: string }; errors?: { detail?: string }[] };
type UserTweetsResp = {
  data?: Array<{ id: string; text: string; created_at?: string }>;
  errors?: { detail?: string }[];
};

async function xApiGet<T>(bearer: string, pathAndQuery: string): Promise<{ ok: true; json: T } | { ok: false; message: string }> {
  const base = (process.env.X_API_BASE_URL ?? "https://api.x.com").replace(/\/$/, "");
  const res = await fetch(`${base}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, message: `Invalid JSON (${res.status}): ${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    const err = (json as UserByUsernameResp).errors?.[0]?.detail ?? text.slice(0, 200);
    return { ok: false, message: `${res.status}: ${err}` };
  }
  return { ok: true, json: json as T };
}

/** X API v2（Bearer）。アクセスレベルは X Developer Portal のプロジェクト設定に依存。 */
async function collectViaOfficialApiBearer(bearer: string, handles: string[]): Promise<CollectedArticle[]> {
  const articles: CollectedArticle[] = [];

  for (const handle of handles) {
    const userRes = await xApiGet<UserByUsernameResp>(
      bearer,
      `/2/users/by/username/${encodeURIComponent(handle)}?user.fields=username`
    );
    if (!userRes.ok) {
      console.warn(`[x-twitter] API user lookup @${handle}:`, userRes.message);
      continue;
    }
    const userId = userRes.json.data?.id;
    if (!userId) continue;

    const tweetsRes = await xApiGet<UserTweetsResp>(
      bearer,
      `/2/users/${userId}/tweets?max_results=${MAX_PER_HANDLE}&tweet.fields=created_at&exclude=retweets`
    );
    if (!tweetsRes.ok) {
      console.warn(`[x-twitter] API tweets @${handle}:`, tweetsRes.message);
      continue;
    }

    const rows = tweetsRes.json.data ?? [];
    for (const t of rows) {
      const text = (t.text ?? "").trim();
      if (!text) continue;
      articles.push({
        source: "x",
        title: text.slice(0, 300),
        url: `https://x.com/${handle}/status/${t.id}`,
        summary: text.length > 300 ? `${text.slice(0, 500)}…` : text,
        publishedAt: t.created_at,
      });
    }
  }

  return articles.slice(0, MAX_TOTAL);
}

export async function collectXTwitter(): Promise<CollectedArticle[]> {
  const handles = loadHandles();
  if (handles.length === 0) return [];

  const bearer = process.env.X_BEARER_TOKEN?.trim() || process.env.TWITTER_BEARER_TOKEN?.trim();
  if (!bearer) {
    console.warn(
      "[x-twitter] X_BEARER_TOKEN is not set; skipping X feeds. See https://github.com/xdevplatform/xmcp for local MCP tooling reference."
    );
    return [];
  }

  return collectViaOfficialApiBearer(bearer, handles);
}
