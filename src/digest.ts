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

  const articles = filterNewArticles(delivered, rawArticles);

  if (articles.length === 0) {
    console.log("[digest] no new articles after dedupe; posting no-news message.");
    await postDigestToSlack([], "今日は特筆すべきニュースはありませんでした（直近配信済みのため新規なし）。");
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
