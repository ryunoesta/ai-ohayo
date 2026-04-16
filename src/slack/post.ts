import type { DigestItem } from "../types.js";

function jstDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(d);
}

function dividerBlock() {
  return { type: "divider" as const };
}

function sectionMrkdwn(text: string) {
  return {
    type: "section" as const,
    text: { type: "mrkdwn" as const, text },
  };
}

const PRIORITY_HEADER: Record<DigestItem["priority"], string> = {
  must_read: "🔴 *今日これだけは読んで*",
  recommended: "🟡 *おすすめ*",
  fyi: "🔵 *余裕があれば*",
};

function groupByPriority(items: DigestItem[]): Record<DigestItem["priority"], DigestItem[]> {
  const g: Record<DigestItem["priority"], DigestItem[]> = {
    must_read: [],
    recommended: [],
    fyi: [],
  };
  for (const it of items) {
    g[it.priority].push(it);
  }
  return g;
}

export function buildDigestBlocks(items: DigestItem[], noNewsMessage?: string, date = new Date()) {
  const label = jstDateLabel(date);
  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `☀️ おはようございます！今日のAI・テック朝刊（${label}）`, emoji: true },
    },
    dividerBlock(),
  ];

  if (items.length === 0) {
    blocks.push(sectionMrkdwn(noNewsMessage ?? "今日は特筆すべきニュースはありませんでした。"));
    blocks.push(dividerBlock());
    blocks.push(sectionMrkdwn("💬 気になる記事はスレッドで @Claude に聞いてね！"));
    return blocks;
  }

  const grouped = groupByPriority(items);
  let n = 1;
  const order: DigestItem["priority"][] = ["must_read", "recommended", "fyi"];

  for (const p of order) {
    const list = grouped[p];
    if (list.length === 0) continue;
    blocks.push(sectionMrkdwn(`${PRIORITY_HEADER[p]}`));
    for (const it of list) {
      const src = it.source || "link";
      const body =
        `${n}. *${escapeSlackMrkdwn(it.title)}*\n` +
        `   → ${escapeSlackMrkdwn(it.oneLiner)}\n` +
        `   _${escapeSlackMrkdwn(it.whyItMatters)}_\n` +
        `   ${escapeSlackMrkdwn(src)} | ${it.url}`;
      blocks.push(sectionMrkdwn(body));
      n += 1;
    }
    blocks.push(dividerBlock());
  }

  blocks.push(sectionMrkdwn("💬 気になる記事はスレッドで @Claude に聞いてね！"));
  return blocks;
}

function escapeSlackMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function postSlackWebhook(payload: {
  text: string;
  blocks?: Record<string, unknown>[];
}): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error("SLACK_WEBHOOK_URL is not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Slack webhook failed: ${res.status} ${t}`);
  }
}

export async function postDigestToSlack(
  items: DigestItem[],
  noNewsMessage?: string,
  date = new Date()
): Promise<void> {
  const label = jstDateLabel(date);
  const fallback =
    items.length === 0
      ? `AI朝刊 (${label}): ${noNewsMessage ?? "本日のニュースなし"}`
      : `AI朝刊 (${label}): ${items.length}件`;
  const blocks = buildDigestBlocks(items, noNewsMessage, date);
  await postSlackWebhook({ text: fallback, blocks });
}

export async function postErrorToSlack(message: string): Promise<void> {
  await postSlackWebhook({
    text: `⚠️ ai-ohayo エラー: ${message}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `⚠️ *ai-ohayo エラー*\n\`\`\`${message.slice(0, 2800)}\`\`\`` },
      },
    ],
  });
}
