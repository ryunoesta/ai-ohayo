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
  must_read: "🔴 今日これだけは読んで",
  recommended: "🟡 おすすめ",
  fyi: "🔵 余裕があれば",
};

function buildItemBlocks(item: DigestItem, index: number, total: number, date = new Date()) {
  const label = jstDateLabel(date);
  const tags = item.tags.filter(Boolean).slice(0, 3);

  return [
    {
      type: "header" as const,
      text: {
        type: "plain_text" as const,
        text: `☀️ AI・テック朝刊 ${label} ${index + 1}/${total}`,
        emoji: true,
      },
    },
    sectionMrkdwn(`${PRIORITY_HEADER[item.priority]}`),
    dividerBlock(),
    sectionMrkdwn(
      `*${escapeSlackMrkdwn(item.title)}*\n` +
        `→ ${escapeSlackMrkdwn(item.oneLiner)}\n` +
        `_${escapeSlackMrkdwn(item.whyItMatters)}_`
    ),
    sectionMrkdwn(
      `*Source* ${escapeSlackMrkdwn(item.source)}\n` +
        `*Link* ${item.url}` +
        (tags.length > 0 ? `\n*Tags* ${tags.map(escapeSlackMrkdwn).join(", ")}` : "")
    ),
    sectionMrkdwn("💬 この投稿のスレッドで @Claude に聞いてね！"),
  ];
}

export function buildDigestBlocks(items: DigestItem[], noNewsMessage?: string, date = new Date()) {
  const label = jstDateLabel(date);
  if (items.length > 0) {
    return items.flatMap((item, index) => buildItemBlocks(item, index, items.length, date));
  }

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `☀️ おはようございます！今日のAI・テック朝刊（${label}）`, emoji: true },
    },
    dividerBlock(),
    sectionMrkdwn(noNewsMessage ?? "今日は特筆すべきニュースはありませんでした。"),
    dividerBlock(),
    sectionMrkdwn("💬 気になる記事はスレッドで @Claude に聞いてね！"),
  ];
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
  if (items.length === 0) {
    const fallback = `AI朝刊 (${label}): ${noNewsMessage ?? "本日のニュースなし"}`;
    const blocks = buildDigestBlocks(items, noNewsMessage, date);
    await postSlackWebhook({ text: fallback, blocks });
    return;
  }

  for (const [index, item] of items.entries()) {
    const fallback = `AI朝刊 (${label}) ${index + 1}/${items.length}: ${item.title}`;
    const blocks = buildItemBlocks(item, index, items.length, date);
    await postSlackWebhook({ text: fallback, blocks });
  }
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
