# ai-ohayo

EC フロント向けの AI・テック朝刊を GitHub Actions で毎朝（JST 5:00）生成し、Slack Incoming Webhook に投稿します。

## 必要なもの

- Node.js 20+
- GitHub Secrets: `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`
- Slack の Incoming Webhook（`#ai-ohayo` など任意のチャンネル）

## セットアップ

```bash
npm ci
cp .env.example .env   # 任意（ローカル実行用）
```

`src/config/profile.yaml` でユーザープロフィールを編集します。

## ローカル実行

```bash
export FIRECRAWL_API_KEY=...
export ANTHROPIC_API_KEY=...
export SLACK_WEBHOOK_URL=...
npm run digest
```

## GitHub に載せるとき

1. リポジトリを作成し、このディレクトリを push
2. Settings → Secrets and variables → Actions に上記 3 つの Secret を登録
3. Actions → 「ai-ohayo」を手動実行して動作確認

スレッドでの質問は公式 Claude Slack App（`@Claude`）に任せます。

## 詳細

要件は `requirements.md` を参照してください。
