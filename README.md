# 美容室向け予約・リマインドBot

LINE Messaging APIを使用した美容室向けの予約管理・リマインドシステムです。

## 機能

- **予約作成**: 店舗スタッフが予約を作成
- **リマインド配信**: 1週間前（ボタン付き）と前日（テキスト）の自動配信
- **予約変更・キャンセル**: LINEボタンから簡単操作
- **予約確認**: LIFFアプリで予約一覧表示

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), TypeScript
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (Auth/DB/RLS)
- **メッセージング**: LINE Messaging API / LIFF
- **デプロイ**: Vercel (Cron Jobs)

## セットアップ

### 1. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```bash
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# LINE設定
LINE_CHANNEL_SECRET=your_line_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
NEXT_PUBLIC_LIFF_ID=your_liff_id_here
NEXT_PUBLIC_LINE_ADD_FRIEND_URL=https://line.me/R/ti/p/your-official-account-id

# アプリ設定
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
TZ=Asia/Tokyo
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

## デプロイ

### Vercelでのデプロイ

1. Vercelにプロジェクトをデプロイ
2. 環境変数をVercelのダッシュボードで設定
3. Cron Jobが自動的に設定されます（毎日10:00 JST）

### LINE Developer Console設定

1. Messaging APIチャネルを作成
2. Channel secret/access tokenを取得
3. Webhook URLを設定: `https://your-domain.vercel.app/api/line/webhook`
4. LIFFアプリを作成（size: full, endpoint: `/liff`）

### 友だち追加〜ID連携フロー（店舗ダッシュボード）

1. 店舗ダッシュボード `/dashboard` から予約作成（ダミー）
2. 友だち追加QRモーダルが表示される
   - QR画像は `public/line-qr-placeholder.svg`（差し替え推奨）
   - 追加ボタンのURLは `NEXT_PUBLIC_LINE_ADD_FRIEND_URL` を利用
3. 追加後に「連携する」ボタン→ `/liff?link=1` を開く
4. LIFFで `userId` を取得し、`POST /api/line/link` に送信
   - 現状はDB保存なしのスタブ（後で実装）

## データベース構造

既存のSupabaseテーブルを使用：

- `customers`: 顧客情報
- `stores`: 店舗情報  
- `store_members`: 店舗メンバー情報
- `reservations`: 予約情報

## API エンドポイント

- `GET /api/cron/reminders`: リマインド配信（Cron用）
- `POST /api/line/webhook`: LINE Webhook受信
- `POST /api/reservations/create`: 予約作成（店舗用）
- `GET /api/reservations/list-mine`: 予約一覧取得（ユーザー用）

## 主要機能の説明

### リマインド配信

- **1週間前**: ボタンテンプレートで変更・キャンセルボタンを提供
- **前日**: テキストメッセージで予約確認

### 予約変更・キャンセル

- LINEボタンから簡単操作
- 変更希望時は店舗への電話連絡を案内
- 冪等性を保証（重複処理防止）

### セキュリティ

- LINE Webhook署名検証
- 予約本人確認
- RLS（Row Level Security）によるデータアクセス制御

## ライセンス

MIT License
