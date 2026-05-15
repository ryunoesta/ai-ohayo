import Parser from "rss-parser";
import type { CollectedArticle } from "../types.js";

/** BBC News Technology（https://www.bbc.com/news/technology 相当のフィード） */
const FEED = "https://feeds.bbci.co.uk/news/technology/rss.xml";

export async function collectBbcTech(): Promise<CollectedArticle[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(FEED);
  return (feed.items ?? []).slice(0, 20).map((item) => ({
    source: "bbc",
    title: (item.title ?? "Untitled").trim().slice(0, 300),
    url: item.link ?? "",
    summary: item.contentSnippet?.slice(0, 500),
    publishedAt: item.isoDate ?? item.pubDate,
    tags: ["Technology"],
  }));
}
