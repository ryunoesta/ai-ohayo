import type { CollectedArticle } from "../types.js";
import { extractMarkdownLinks } from "../lib/links.js";
import { scrapeMarkdown } from "../lib/firecrawl.js";

const TRENDING_URL =
  "https://github.com/trending/typescript?since=daily&spoken_language_code=";

export async function collectGithubTrending(): Promise<CollectedArticle[]> {
  const md = await scrapeMarkdown(TRENDING_URL);
  if (!md) return [];
  const links = extractMarkdownLinks(md, (u) => /^https?:\/\/github\.com\/[^/]+\/[^/?#]+/.test(u));
  const out: CollectedArticle[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    const parts = new URL(l.url).pathname.split("/").filter(Boolean);
    if (parts.length < 2) continue;
    const name = `${parts[0]}/${parts[1]}`;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      source: "github",
      title: l.title.includes("/") ? l.title : `${name} — ${l.title}`,
      url: l.url,
    });
    if (out.length >= 15) break;
  }
  return out;
}
