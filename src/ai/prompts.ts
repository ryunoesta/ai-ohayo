import type { CollectedArticle } from "../types.js";

export function buildSummarizePrompt(profileYaml: string, articles: CollectedArticle[]): string {
  const lines = articles.map((a, i) => {
    const parts = [
      `${i + 1}. [${a.source}] ${a.title}`,
      `   URL: ${a.url}`,
    ];
    if (a.summary) parts.push(`   概要: ${a.summary.slice(0, 400)}`);
    if (a.publishedAt) parts.push(`   日時: ${a.publishedAt}`);
    return parts.join("\n");
  });

  return `あなたはテック情報の編集者です。以下のユーザープロフィールに基づき、記事を優先度付けしてダイジェスト用のJSONを返してください。

## ユーザープロフィール（YAML）
${profileYaml}

## 収集した記事
${lines.join("\n\n")}

## 優先度の基準
- must_read: 自分の技術スタック・業務に直接影響する。知らないと損する
- recommended: 知っておくと差がつく。短時間で読める価値がある
- fyi: 今すぐは不要だが、トレンド把握として有用

## 出力ルール
- 返却は **JSONのみ**（前後に説明文やマークダウンコードフェンスを付けない）
- スキーマ:
{"items":[{"priority":"must_read"|"recommended"|"fyi","title":"string","oneLiner":"string","whyItMatters":"string","url":"string","source":"string","tags":["string"]}]}
- 記事が多い場合は **最大10件** に絞る（重要度の高い順）
- 入力にないURLを捏造しない。必ず上記リストのURLのいずれかを使う
- 該当がない、またはすべて明らかに不要な場合は items を空配列にし、代わりに次のフィールドを付ける:
{"items":[],"noNewsMessage":"今日は特筆すべきニュースはありませんでした"}
- tags は英語または日本語の短いキーワード（3個以内が目安）
`;
}
