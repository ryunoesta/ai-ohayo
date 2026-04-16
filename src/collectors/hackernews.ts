import type { CollectedArticle } from "../types.js";

const HN_ITEM = "https://hacker-news.firebaseio.com/v0/item";
const HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json";

/** AI / フロントエンド関連っぽいタイトルを優先 */
const KEYWORD_RE =
  /(ai\b|llm|gpt|claude|openai|anthropic|gemini|machine learning|neural|deep learning|generative|llama|mistral|copilot|transformer|langchain|rag\b|embedding|agent|react|next\.?js|typescript|javascript|frontend|webgpu|wasm|vite|tailwind)/i;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function collectHackerNews(): Promise<CollectedArticle[]> {
  const ids = await fetchJson<number[]>(HN_TOP);
  const slice = ids.slice(0, 40);
  const items = await Promise.all(
    slice.map(async (id) => {
      try {
        const row = await fetchJson<{
          title?: string;
          url?: string;
          time?: number;
        }>(`${HN_ITEM}/${id}.json`);
        return { id, row };
      } catch {
        return { id, row: null as null };
      }
    })
  );
  const articles: CollectedArticle[] = [];
  for (const { id, row } of items) {
    if (!row?.title) continue;
    if (!KEYWORD_RE.test(row.title)) continue;
    const url =
      row.url && /^https?:\/\//i.test(row.url)
        ? row.url
        : `https://news.ycombinator.com/item?id=${id}`;
    articles.push({
      source: "hackernews",
      title: row.title,
      url,
      publishedAt: row.time ? new Date(row.time * 1000).toISOString() : undefined,
    });
    if (articles.length >= 20) break;
  }
  return articles;
}
