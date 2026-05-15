import type { CollectedArticle } from "../types.js";
import { extractMarkdownLinks, toAbsoluteUrl } from "../lib/links.js";
import { scrapeMarkdown } from "../lib/firecrawl.js";

const ANTHROPIC_NEWS_URL = "https://www.anthropic.com/news";

/** Anthropic は公開のニュースページに RSS がないため、Firecrawl を使って Markdown を取得してリンクを抽出する */
export async function collectAnthropicBlog(): Promise<CollectedArticle[]> {
  const md = await scrapeMarkdown(ANTHROPIC_NEWS_URL);
  if (!md) return [];

  const links = extractMarkdownLinks(md, (u) => /anthropic\.com\/news\//.test(u));
  const out: CollectedArticle[] = [];
  const seen = new Set<string>();
  for (const l of links.slice(0, 20)) {
    const url = toAbsoluteUrl(l.url, "https://www.anthropic.com/");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      source: "anthropic",
      title: l.title.slice(0, 300),
      url,
    });
  }
  return out;
}
