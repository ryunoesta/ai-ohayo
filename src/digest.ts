import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAllCollectors } from "./collectors/index.js";
import { summarizeToDigest } from "./ai/summarize.js";
import { postDigestToSlack, postErrorToSlack } from "./slack/post.js";
import {
  appendDelivered,
  filterNewArticles,
  loadDelivered,
  saveDelivered,
} from "./lib/delivered.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = join(__dirname, "config/profile.yaml");

function toJstDateKey(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function filterTodayArticles<T extends { publishedAt?: string }>(articles: T[], now = new Date()): T[] {
  const today = toJstDateKey(now);
  return articles.filter((article) => {
    if (!article.publishedAt) return false;
    const publishedAt = new Date(article.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) return false;
    return toJstDateKey(publishedAt) === today;
  });
}

async function main() {
  const profileYaml = readFileSync(PROFILE_PATH, "utf-8");
  let delivered = loadDelivered();

  const { results, articles: rawArticles } = await runAllCollectors();

  const allCollectorsFailed = results.length > 0 && results.every((r) => !r.ok);
  if (allCollectorsFailed) {
    const msg = results.map((r) => `${r.name}: ${r.error}`).join("\n");
    console.error("[digest] all collectors failed:\n", msg);
    await postErrorToSlack(`全 collector が失敗しました:\n${msg}`);
    process.exit(1);
  }

  const todaysArticles = filterTodayArticles(rawArticles);
  const articles = filterNewArticles(delivered, todaysArticles);

  if (articles.length === 0) {
    console.log("[digest] no new articles published today after dedupe; posting no-news message.");
    await postDigestToSlack([], "今日は公開日の新着記事はありませんでした。");
    process.exit(0);
  }

  let items: Awaited<ReturnType<typeof summarizeToDigest>>["items"];
  let noNewsMessage: string | undefined;
  try {
    const out = await summarizeToDigest(profileYaml, articles);
    items = out.items;
    noNewsMessage = out.noNewsMessage;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[digest] Claude API failed:", msg);
    await postErrorToSlack(`Claude API 失敗: ${msg}`);
    process.exit(1);
  }

  await postDigestToSlack(items, noNewsMessage);

  if (items.length > 0) {
    appendDelivered(
      delivered,
      items.map((i) => i.url),
      new Date()
    );
    saveDelivered(delivered);
  }

  process.exit(0);
}

main().catch(async (e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e);
  try {
    await postErrorToSlack(`未処理エラー: ${msg}`);
  } catch {
    // ignore
  }
  process.exit(1);
});
