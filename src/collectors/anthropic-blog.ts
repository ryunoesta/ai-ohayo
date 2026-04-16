import type { CollectedArticle } from "../types.js";
import { toAbsoluteUrl } from "../lib/links.js";

const ANTHROPIC_NEWS_URL = "https://www.anthropic.com/news";
const CARD_RE =
  /<a[^>]+href="(\/news\/[^"#?]+)"[^>]*>[\s\S]*?<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?[\s\S]*?<\/a>/g;

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function collectAnthropicBlog(): Promise<CollectedArticle[]> {
  const res = await fetch(ANTHROPIC_NEWS_URL);
  if (!res.ok) {
    throw new Error(`Anthropic news fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  const seen = new Set<string>();
  const articles: CollectedArticle[] = [];

  for (const match of html.matchAll(CARD_RE)) {
    const href = match[1];
    const title = decodeHtmlEntities(stripTags(match[2] ?? ""));
    const summary = decodeHtmlEntities(stripTags(match[3] ?? ""));
    const url = toAbsoluteUrl(href, "https://www.anthropic.com/");
    if (!title || seen.has(url)) continue;

    seen.add(url);
    articles.push({
      source: "anthropic",
      title: title.slice(0, 300),
      url,
      summary: summary ? summary.slice(0, 500) : undefined,
    });

    if (articles.length >= 20) break;
  }

  return articles;
}
