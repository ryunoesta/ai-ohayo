import Parser from "rss-parser";
import type { CollectedArticle } from "../types.js";
import { extractMarkdownLinks } from "../lib/links.js";
import { scrapeMarkdown } from "../lib/firecrawl.js";

const FEEDS = [
  "https://zenn.dev/feed",
  "https://zenn.dev/topics/tech/feed",
  "https://zenn.dev/topics/nextjs/feed",
  "https://zenn.dev/topics/typescript/feed",
];

const parser = new Parser();

async function fetchFeed(url: string): Promise<CollectedArticle[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).slice(0, 12).map((item) => ({
    source: "zenn",
    title: (item.title ?? "Untitled").trim(),
    url: item.link ?? "",
    summary: item.contentSnippet?.slice(0, 500),
    publishedAt: item.isoDate ?? item.pubDate,
    tags: Array.isArray(item.categories)
      ? item.categories.map(String)
      : undefined,
  }));
}

export async function collectZennRss(): Promise<CollectedArticle[]> {
  const results = await Promise.all(
    FEEDS.map(async (u) => {
      try {
        return await fetchFeed(u);
      } catch (e) {
        console.warn("[zenn] RSS failed:", u, e instanceof Error ? e.message : e);
        return [];
      }
    })
  );
  const merged = results.flat();
  const seen = new Set<string>();
  const out: CollectedArticle[] = [];
  for (const a of merged) {
    if (!a.url || seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out.slice(0, 25);
}

/** Zenn トップのトレンド（Firecrawl） */
export async function collectZennTrending(): Promise<CollectedArticle[]> {
  const md = await scrapeMarkdown("https://zenn.dev");
  if (!md) return [];
  const links = extractMarkdownLinks(md, (u) => /zenn\.dev\/[^/]+\/articles\//.test(u));
  return links.slice(0, 15).map((l) => ({
    source: "zenn",
    title: l.title.slice(0, 200),
    url: l.url,
  }));
}

export async function collectZenn(): Promise<CollectedArticle[]> {
  // トレンドは RSS（FEEDS）でカバーするため、まずはRSSのみを返す
  return await collectZennRss();
}
