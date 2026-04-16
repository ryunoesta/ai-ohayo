import Anthropic from "@anthropic-ai/sdk";
import type { CollectedArticle, DigestItem } from "../types.js";
import { buildSummarizePrompt } from "./prompts.js";

const MODEL = "claude-sonnet-4-20250514";

type ApiDigest = {
  items?: DigestItem[];
  noNewsMessage?: string;
};

function extractJsonObject(text: string): unknown {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/;
  const m = t.match(fence);
  const body = m ? m[1].trim() : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("JSON object not found in model response");
  }
  return JSON.parse(body.slice(start, end + 1));
}

function validateItem(x: unknown): x is DigestItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const pr = o.priority;
  const okPr = pr === "must_read" || pr === "recommended" || pr === "fyi";
  return (
    okPr &&
    typeof o.title === "string" &&
    typeof o.oneLiner === "string" &&
    typeof o.whyItMatters === "string" &&
    typeof o.url === "string" &&
    typeof o.source === "string" &&
    Array.isArray(o.tags)
  );
}

export async function summarizeToDigest(
  profileYaml: string,
  articles: CollectedArticle[]
): Promise<{ items: DigestItem[]; noNewsMessage?: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildSummarizePrompt(profileYaml, articles);

  const runOnce = async () => {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("No text in Claude response");
    return extractJsonObject(block.text) as ApiDigest;
  };

  let parsed: ApiDigest;
  try {
    parsed = await runOnce();
  } catch (e) {
    console.warn("[summarize] first attempt failed, retrying once:", e);
    parsed = await runOnce();
  }

  const items = (parsed.items ?? []).filter(validateItem);
  return {
    items: items.slice(0, 10),
    noNewsMessage: typeof parsed.noNewsMessage === "string" ? parsed.noNewsMessage : undefined,
  };
}
