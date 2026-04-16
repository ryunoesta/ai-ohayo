import type { CollectedArticle } from "../types.js";
import { extractMarkdownLinks, toAbsoluteUrl } from "../lib/links.js";
import { scrapeMarkdown } from "../lib/firecrawl.js";

export async function collectGoogleAiBlog(): Promise<CollectedArticle[]> {
  const md = await scrapeMarkdown("https://blog.google/technology/ai/");
  if (!md) return [];
  const links = extractMarkdownLinks(md, (u) =>
    /blog\.google\/technology\/ai\//i.test(u)
  );
  return links.slice(0, 20).map((l) => ({
    source: "google",
    title: l.title.slice(0, 300),
    url: toAbsoluteUrl(l.url, "https://blog.google/"),
  }));
}
