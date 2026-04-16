import Parser from "rss-parser";
import type { CollectedArticle } from "../types.js";

export async function collectGoogleAiBlog(): Promise<CollectedArticle[]> {
  const parser = new Parser();
  const feed = await parser.parseURL("https://blog.google/technology/ai/rss/");
  return (feed.items ?? []).slice(0, 20).map((item) => ({
    source: "google",
    title: (item.title ?? "Untitled").trim().slice(0, 300),
    url: item.link ?? "",
    summary: item.contentSnippet?.slice(0, 500),
    publishedAt: item.isoDate ?? item.pubDate,
    tags: Array.isArray(item.categories)
      ? item.categories.map(String).slice(0, 3)
      : undefined,
  }));
}
