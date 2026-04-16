import type { CollectedArticle } from "../types.js";
import { extractMarkdownLinks, toAbsoluteUrl } from "../lib/links.js";
import { scrapeMarkdown } from "../lib/firecrawl.js";

export async function collectOpenAiBlog(): Promise<CollectedArticle[]> {
  const md = await scrapeMarkdown("https://openai.com/blog");
  if (!md) return [];
  const links = extractMarkdownLinks(md, (u) => /openai\.com\/blog/i.test(u));
  return links.slice(0, 20).map((l) => ({
    source: "openai",
    title: l.title.slice(0, 300),
    url: toAbsoluteUrl(l.url, "https://openai.com/"),
  }));
}
