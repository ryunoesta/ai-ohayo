import type { CollectedArticle } from "../types.js";
import { collectZenn } from "./zenn.js";
import { collectOpenAiBlog } from "./openai-blog.js";
import { collectAnthropicBlog } from "./anthropic-blog.js";
import { collectGoogleAiBlog } from "./google-ai-blog.js";
import { collectHackerNews } from "./hackernews.js";
import { collectGithubTrending } from "./github-trending.js";

type CollectorName =
  | "zenn"
  | "openai"
  | "anthropic"
  | "google"
  | "hackernews"
  | "github";

const COLLECTORS: Record<CollectorName, () => Promise<CollectedArticle[]>> = {
  zenn: collectZenn,
  openai: collectOpenAiBlog,
  anthropic: collectAnthropicBlog,
  google: collectGoogleAiBlog,
  hackernews: collectHackerNews,
  github: collectGithubTrending,
};

export type CollectorResult = {
  name: CollectorName;
  ok: boolean;
  articles: CollectedArticle[];
  error?: string;
};

export async function runAllCollectors(): Promise<{
  results: CollectorResult[];
  articles: CollectedArticle[];
}> {
  const entries = Object.entries(COLLECTORS) as [CollectorName, () => Promise<CollectedArticle[]>][];
  const settled = await Promise.allSettled(entries.map(([, fn]) => fn()));

  const results: CollectorResult[] = settled.map((s, i) => {
    const name = entries[i][0];
    if (s.status === "fulfilled") {
      return { name, ok: true, articles: s.value };
    }
    const err = s.reason instanceof Error ? s.reason.message : String(s.reason);
    console.warn(`[collectors] ${name} failed:`, err);
    return { name, ok: false, articles: [], error: err };
  });

  const seen = new Set<string>();
  const articles: CollectedArticle[] = [];
  for (const r of results) {
    for (const a of r.articles) {
      if (!a.url) continue;
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      articles.push(a);
    }
  }

  return { results, articles };
}
