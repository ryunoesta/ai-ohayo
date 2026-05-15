# ai-ohayo

EC フロント向けの AI・テック朝刊を GitHub Actions で毎朝（JST 5:00）生成し、Slack Incoming Webhook に投稿します。個人利用向けに作者が作ったもので、**fork やテンプレから使われることも想定**して公開しているため、後述の `delivered.json` の扱いを読んでおいてください。

## 必要なもの

- Node.js 20+
- GitHub Secrets: `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`
- **任意（X）:** `X_BEARER_TOKEN` — [X Developer Portal](https://developer.x.com/) のプロジェクトで発行する **API v2 の Bearer Token**（`users/by/username` / `users/:id/tweets` が使えるアクセスレベルが必要）。
- Slack の Incoming Webhook（`#ai-ohayo` など任意のチャンネル）

主なソース: **Zenn**（公式トレンド `/feed` ＋ トピック RSS）、**OpenAI / Google AI**（RSS）、**Anthropic News**（Firecrawl で一覧を scrape し Markdown からリンク抽出）、**Hacker News**（公式 JSON API）、**TechCrunch**（RSS）、**BBC Technology**（RSS）、**X**（`X_BEARER_TOKEN` ＋ `src/config/x-twitter.yaml`）。

実装上のcollector一覧（`src/collectors/index.ts`）: `zenn`, `openai`, `anthropic`, `google`, `hackernews`, `techcrunch`, `bbc`, `x`。

## セットアップ

```bash
npm ci
cp .env.example .env   # 任意（ローカル実行用）
```

`src/config/profile.yaml` でユーザープロフィールを編集し、X を使う場合は `src/config/x-twitter.yaml` でアカウント（handles）を編集します。

**fork して自分用に動かす方へ:** 作者の運用の名残で、`data/delivered.json`（投稿済み URL を覚えておくファイル）がリポジトリに含まれることがあります。Actions はこのファイルを更新して push する設計なので、**clone した時点では作者環境の投稿履歴が入っている**ことがあります。自分用に使うときは、重複判定をクリーンにする意味でも、**`{"entries":[]}` から始める**ことをおすすめします（意図せず「もう出した」とみなされてスキップされるのを防げます）。

```bash
echo '{"entries":[]}' > data/delivered.json
git add data/delivered.json && git commit -m "chore: delivered.json を自分用に初期化"
```

## ローカル実行

```bash
export FIRECRAWL_API_KEY=...
export ANTHROPIC_API_KEY=...
export SLACK_WEBHOOK_URL=...
export X_BEARER_TOKEN=...   # 任意（X を収集するとき）
npm run digest
```

## GitHub に載せるとき

1. このリポジトリを fork するか、内容を自分のリポジトリへ push（**fork して運用する場合は、先に「fork して自分用に動かす方へ」のとおり `data/delivered.json` を整えてから進めると安全です**）
2. Settings → Secrets and variables → Actions に `FIRECRAWL_API_KEY` / `ANTHROPIC_API_KEY` / `SLACK_WEBHOOK_URL` を登録（任意で `X_BEARER_TOKEN`）
3. Actions → 「ai-ohayo」を手動実行して動作確認

スレッドでの質問は公式 Claude Slack App（`@Claude`）に任せます。

## 詳細

実装の詳細は `src/collectors/` 各モジュールと `src/digest.ts` を参照してください。
