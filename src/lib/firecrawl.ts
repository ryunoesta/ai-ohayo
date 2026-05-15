type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: unknown;
  };
  markdown?: unknown;
};

export async function scrapeMarkdown(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    console.warn("[firecrawl] FIRECRAWL_API_KEY is not set; skipping scrape:", url);
    return null;
  }

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const text = await res.text();
    let json: FirecrawlScrapeResponse;
    try {
      json = text ? (JSON.parse(text) as FirecrawlScrapeResponse) : {};
    } catch {
      console.warn("[firecrawl] invalid JSON:", url, text.slice(0, 200));
      return null;
    }

    if (!res.ok || json.success === false) {
      console.warn("[firecrawl] scrape unsuccessful:", url, res.status, text.slice(0, 200));
      return null;
    }

    const markdown =
      typeof json.data?.markdown === "string"
        ? json.data.markdown
        : typeof json.markdown === "string"
          ? json.markdown
          : "";
    return markdown.trim() || null;
  } catch (e) {
    console.warn("[firecrawl] scrape failed:", url, e instanceof Error ? e.message : e);
    return null;
  }
}
