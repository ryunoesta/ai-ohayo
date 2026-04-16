import type { CollectedArticle } from "../types.js";
import { extractMarkdownLinks, toAbsoluteUrl } from "../lib/links.js";
import { scrapeMarkdown } from "../lib/firecrawl.js";

export async function collectAnthropicBlog(): Promise<CollectedArticle[]> {
  const md = await scrapeMarkdown("https://www.anthropic.com/news");
  if (!md) return [];
  const links = extractMarkdownLinks(md, (u) => /anthropic\.com\/(news|research)/i.test(u));
  return links.slice(0, 20).map((l) => ({
    source: "anthropic",
    title: l.title.slice(0, 300),
    url: toAbsoluteUrl(l.url, "https://www.anthropic.com/"),
  }));
}
