# AI情報キャッチアップBot — 要件定義書 v2

## 1. プロジェクト概要

EC制作会社のフロントエンドエンジニア向けに、AI・フロントエンド関連の最新情報を自動収集・要約・優先度付けし、毎朝Slackに配信するシステム。

スレッドでの質問対応は **公式 Claude Slack App** に委ねる（`@Claude` でメンションするだけ）。

---

## 2. システム構成

```
GitHub Actions (cron: 毎朝 5:00 JST)
  │
  ├─ 1. 情報収集（Firecrawl / RSS / API）
  │     Zenn, OpenAI, Anthropic, Google AI, Hacker News, TechCrunch, BBC Tech, X（任意） ...
  │
  ├─ 2. AI要約・優先度付け（Claude API）
  │     ユーザープロフィールに基づき must_read / recommended / fyi に分類
  │
  └─ 3. Slack投稿（Incoming Webhook）
        #ai-ohayo チャンネルに朝刊を投稿

─────────────────────────────────────

スレッドQ&A:
  ユーザーがスレッドで @Claude に質問
  → 公式Claude Slack Appが朝刊本文を文脈として読み、回答
  → 自前実装は不要
```

**この構成のメリット:**
- 自前のバックエンド不要（Cloudflare Workers不要）
- Slack App自作不要（OAuth、署名検証、Event API対応が全部なくなる）
- 実装・保守するのはGitHub Actionsのワークフロー1本だけ
- Claude Slack Appは無料でインストール可能

---

## 3. 情報ソースと収集方法

| # | ソース | 取得方法 | エンドポイント / 備考 |
|---|--------|----------|----------------------|
| 1 | **Zenn** | RSS | `https://zenn.dev/feed` トピック別 feed 等 |
| 2 | **Zenn トレンド** | Firecrawl | `https://zenn.dev` トップ |
| 3 | **OpenAI Blog** | RSS | `https://openai.com/news/rss.xml` |
| 4 | **Anthropic News** | fetch + HTML | `https://www.anthropic.com/news`（正規表現パース） |
| 5 | **Google AI Blog** | RSS | `https://blog.google/technology/ai/rss/` |
| 6 | **Hacker News** | API | `https://hacker-news.firebaseio.com/v0/topstories.json` 等・タイトルでフィルタ |
| 7 | **TechCrunch** | RSS | `https://techcrunch.com/feed/` |
| 8 | **BBC Technology** | RSS | `https://feeds.bbci.co.uk/news/technology/rss.xml`（bbc.com/news/technology 相当） |
| 9 | **X** | X API v2 | `X_BEARER_TOKEN`: `GET /2/users/by/username/:username` → `GET /2/users/:id/tweets`。handles は `src/config/x-twitter.yaml` |

### X（Twitter）

- 環境変数 `X_BEARER_TOKEN`（[X Developer Portal](https://developer.x.com/)）。ユーザーの最新ポストを公式 API で取得。利用可能なエンドポイントはプロジェクトのプラン・権限による。
- ローカルで MCP から X API を試す場合は公式の [xdevplatform/xmcp](https://github.com/xdevplatform/xmcp) を参照（本リポジトリの digest は Node から直接 `fetch` のみ）。

### Firecrawl 利用設計

```
使用API: Firecrawl /v1/scrape
用途: RSS非対応サイトから記事タイトル・URL・要約を取得

リクエスト例:
POST https://api.firecrawl.dev/v1/scrape
{
  "url": "https://openai.com/blog",
  "formats": ["markdown"],
  "onlyMainContent": true
}
```

**Firecrawl 無料枠: 500 クレジット/月（1 スクレイプ = 1 クレジット）**
- 1日 4 ソース × 30日 = 120 クレジット/月 → 無料枠内
- 各ソースは 1 リクエストでリスト取得。個別記事の全文取得はしない

---

## 4. 収集データの型定義

```typescript
type CollectedArticle = {
  source: string;       // "zenn" | "openai" | "anthropic" | "google" | "hackernews" | "techcrunch" | "bbc" | "x" 等
  title: string;
  url: string;
  summary?: string;     // 取得できる場合
  publishedAt?: string; // ISO 8601
  tags?: string[];
};

type DigestItem = {
  priority: "must_read" | "recommended" | "fyi";
  title: string;
  oneLiner: string;      // 1行で何が重要か
  whyItMatters: string;  // 自分にとってなぜ重要か（2〜3文）
  url: string;
  source: string;
  tags: string[];
};
```

---

## 5. AI要約・優先度付け

**使用モデル:** Claude claude-sonnet-4-20250514（コストと品質のバランス）

### ユーザープロフィール（設定ファイルで管理）

```yaml
# config/profile.yaml
role: "フロントエンドエンジニア（2年目）"
company_type: "EC制作会社"
tech_stack:
  - Next.js
  - React
  - TypeScript
  - Tailwind CSS
interests:
  - AIの業務活用
  - フロントエンド最新動向
  - LLM / プロンプトエンジニアリング
  - EC関連技術
  - キャリア・生産性
concern: "AIの進化が速くて焦っている。実務に直結する情報を優先したい"
```

### 優先度の判定基準（プロンプトに明記する）

| 優先度 | 基準 |
|--------|------|
| 🔴 must_read | 自分の技術スタック・業務に直接影響する。知らないと損する |
| 🟡 recommended | 知っておくと差がつく。1〜2分で読める |
| 🔵 fyi | 今すぐは不要だが、トレンド把握として |

### プロンプトの要件

Claude APIに渡す情報:
- 収集した記事一覧（タイトル・URL・概要）
- ユーザープロフィール

Claude APIに求める出力:
- 各記事を `DigestItem` 形式で返却
- 記事数が多い場合は上位10件程度に絞る
- 該当記事がゼロの日は「今日は特筆すべきニュースはありませんでした」と返す
- JSON形式で出力させ、Slack整形はNode.js側で行う

---

## 6. Slack投稿

### 投稿フォーマット

```
☀️ おはようございます！今日のAI・テック朝刊（4/16）

━━━━━━━━━━━━━━━━━━━━━━

🔴 今日これだけは読んで

1. Next.js 15.3でServer Actionsに破壊的変更
   → EC案件で使ってるなら即確認。formのバリデーション周りが変わった
   Zenn | https://zenn.dev/xxx

2. Anthropic、Claude Code正式リリース
   → ターミナルから直接AIコーディングできるように。無料で試せる
   Anthropic Blog | https://anthropic.com/xxx

━━━━━━━━━━━━━━━━━━━━━━

🟡 おすすめ

3. Cursor vs Claude Code、どっちが使える？比較記事
   → 実務でのAIコーディングツール選定の参考に
   Zenn | https://zenn.dev/xxx

━━━━━━━━━━━━━━━━━━━━━━

🔵 余裕があれば

4. OpenAI、GPT-5の噂まとめ
   → 直近の業務影響はないが、年内リリースの可能性
   Hacker News | https://xxx

━━━━━━━━━━━━━━━━━━━━━━
💬 気になる記事はスレッドで @Claude に聞いてね！
```

### 投稿方法

**Slack Incoming Webhook** を使用（最もシンプル）。

Webhook URLの取得手順:
1. https://api.slack.com/apps でアプリ作成
2. Incoming Webhooks を有効化
3. `#ai-ohayo` チャンネルにWebhook追加
4. URLをGitHub Secretsに `SLACK_WEBHOOK_URL` として保存

---

## 7. GitHub Actions

```yaml
# .github/workflows/ai-ohayo.yml
name: ai-ohayo

on:
  schedule:
    - cron: '0 20 * * *'  # UTC 20:00 = JST 05:00
  workflow_dispatch:        # 手動実行（デバッグ用）

env:
  FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

jobs:
  digest:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx tsx src/digest.ts
```

### 実行フロー（`src/digest.ts`）

```
1. collectors/ 配下の各ソース収集モジュールを Promise.allSettled で並列実行
2. 成功した結果を CollectedArticle[] に統合
3. Claude API に送信 → DigestItem[] を取得
4. Slack Block Kit フォーマットに整形
5. Slack Webhook で投稿
6. 失敗したcollectorがあればログ出力（全滅時のみエラー通知）
```

---

## 8. ディレクトリ構成

```
ai-ohayo/
├── .github/
│   └── workflows/
│       └── ai-ohayo.yml
├── src/
│   ├── digest.ts                  # メインエントリ
│   ├── collectors/
│   │   ├── zenn.ts
│   │   ├── openai-blog.ts
│   │   ├── anthropic-blog.ts
│   │   ├── google-ai-blog.ts
│   │   ├── hackernews.ts
│   │   ├── techcrunch.ts
│   │   ├── bbc-tech.ts
│   │   ├── x-twitter.ts
│   │   └── index.ts
│   ├── ai/
│   │   ├── summarize.ts
│   │   └── prompts.ts
│   ├── slack/
│   │   └── post.ts
│   ├── config/
│   │   ├── profile.yaml
│   │   └── x-twitter.yaml       # X アカウント一覧（x-twitter collector）
│   └── types.ts
├── data/
│   └── delivered.json             # 配信済みURL（重複排除用）
├── package.json
├── tsconfig.json
└── README.md
```

---

## 9. 必要なアカウント・APIキー

| サービス | 用途 | 費用目安 |
|----------|------|----------|
| **Firecrawl** | Webスクレイピング | 無料（500クレジット/月） |
| **Anthropic API** | 要約生成 | ~$1〜3/月（Sonnet、1日1回） |
| **Slack Incoming Webhook** | 朝刊投稿 | 無料 |
| **Claude Slack App** | スレッドQ&A | 無料（Proプラン加入が必要な場合あり） |
| **GitHub Actions** | cron実行 | 無料（パブリックrepo）/ 2,000分/月（プライベート） |
| **X Developer（任意）** | X タイムライン取得（Bearer） | [プラン・無料枠は公式要確認](https://developer.x.com/) |

**月額合計: 約$1〜3（Anthropic API利用料のみ）** ※ X は利用しなければ 0、API 課金の有無はアプリ設定による

---

## 10. 非機能要件

### エラーハンドリング
- 各 collector は独立して失敗可能（`Promise.allSettled` で1つ失敗しても他は続行）
- Firecrawl / 外部API失敗時 → その source をスキップしてログ出力
- 全 collector 失敗時のみ Slack にエラー通知を投稿
- Claude API 失敗 → リトライ1回、それでも失敗ならエラー通知

### 重複排除
- `data/delivered.json` に直近7日分の配信済みURLを保持
- digest.ts 実行後に更新 → git commit & push（GitHub Actions内で）
- 7日超過分は自動で削除

### セキュリティ
- APIキーはすべて GitHub Secrets に格納
- リポジトリはプライベート推奨

---

## 11. 実装の推奨順序

```
Phase 1 — MVP（半日）
  ① Zenn RSS collector だけ実装
  ② Claude API で要約
  ③ Slack Webhook で投稿
  ④ workflow_dispatch で手動実行して動作確認
  → ここで「毎朝届く」体験がまず完成する

Phase 2 — ソース拡充（半日〜1日）
  ⑤ 残りの collectors を追加（Firecrawl系）
  ⑥ cron スケジュール有効化
  ⑦ 重複排除の仕組み追加

Phase 3 — Q&A有効化（10分）
  ⑧ Claude Slack App をワークスペースにインストール
  ⑨ #ai-ohayo チャンネルに招待
  ⑩ スレッドで @Claude に質問 → 動作確認

Phase 4 — 安定化（半日）
  ⑪ エラーハンドリング強化
  ⑫ profile.yaml の調整（優先度の精度チューニング）
  ⑬ README整備
```

---

## 12. 主要ライブラリ

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@mendable/firecrawl-js": "latest",
    "rss-parser": "^3.13.0",
    "yaml": "^2.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

Slack投稿は `fetch` で Webhook URL に POST するだけなので、SDKは不要。

---

## 13. 拡張ポイント（v2以降）

- **X API連携:** コスト許容できれば特定アカウント・ハッシュタグの監視
- **週次まとめ:** 1週間分のダイジェストを土曜朝にまとめ配信
- **フィードバックループ:** 👍/👎 リアクションで優先度判定の精度改善
- **記事全文要約:** スレッドにURL貼って @Claude に「要約して」で対応可能（公式アプリの機能で実現）
