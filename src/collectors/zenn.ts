import Parser from "rss-parser";
import type { CollectedArticle } from "../types.js";

/** トレンド（公式: https://zenn.dev/zenn/articles/zenn-feed-rss） */
const ZENN_TREND_FEED = "https://zenn.dev/feed";

const ZENN_TOPIC_FEEDS = [
  "https://zenn.dev/topics/tech/feed",
  "https://zenn.dev/topics/nextjs/feed",
  "https://zenn.dev/topics/typescript/feed",
];

const FEEDS = [ZENN_TREND_FEED, ...ZENN_TOPIC_FEEDS];

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

export async function collectZenn(): Promise<CollectedArticle[]> {
  return await collectZennRss();
}
