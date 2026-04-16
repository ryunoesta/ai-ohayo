import Parser from "rss-parser";
import type { CollectedArticle } from "../types.js";

export async function collectOpenAiBlog(): Promise<CollectedArticle[]> {
  const parser = new Parser();
  const feed = await parser.parseURL("https://openai.com/news/rss.xml");
  return (feed.items ?? []).slice(0, 20).map((item) => ({
    source: "openai",
    title: (item.title ?? "Untitled").trim().slice(0, 300),
    url: item.link ?? "",
    summary: item.contentSnippet?.slice(0, 500),
    publishedAt: item.isoDate ?? item.pubDate,
    tags: Array.isArray(item.categories)
      ? item.categories.map(String).slice(0, 3)
      : undefined,
  }));
}
