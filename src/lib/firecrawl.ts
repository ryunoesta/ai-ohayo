import FirecrawlApp from "@mendable/firecrawl-js";

export async function scrapeMarkdown(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    console.warn("[firecrawl] FIRECRAWL_API_KEY is not set; skipping scrape:", url);
    return null;
  }
  const app = new FirecrawlApp({ apiKey: key });
  try {
    const res = await app.scrapeUrl(url, {
      formats: ["markdown"],
      onlyMainContent: true,
    });
    if (!res || typeof res !== "object" || !("success" in res) || res.success === false) {
      console.warn("[firecrawl] scrape unsuccessful:", url, res);
      return null;
    }
    const markdown =
      "markdown" in res && typeof (res as { markdown?: unknown }).markdown === "string"
        ? (res as { markdown: string }).markdown
        : "";
    return markdown.trim() || null;
  } catch (e) {
    console.warn("[firecrawl] scrape failed:", url, e instanceof Error ? e.message : e);
    return null;
  }
}
