# 🌹 Project X Butler

Project X Butler は、X（旧Twitter）の運用を支援する自動化Botです。

Google Cloud、Playwright、Google Apps Script（GAS）、Google スプレッドシートを利用し、ルールに従って自動で投稿やリアクションを行います。

> **Project X Butler は、運用ルールをコードではなく設定で管理し、誰でも扱いやすい X 自動化Bot を目指すプロジェクトです。**

---

## ✨ Features

### v1.0

- 🔁 キーワードによる自動リポスト
- ❤️ キーワードによる自動いいね
- 📊 実行ログ保存（`logs/YYYY-MM-DD.log` に JSON Lines 形式で保存）
- ⚙️ スプレッドシートによる設定管理（Google Sheets、任意。未設定時はローカルの `config/config.json` を使用）
- 🧪 テストモード（既定で有効。実際のリポスト／いいねは行わず、判定結果だけをログに記録）

### 🚀 Planned Features

- 📝 ランダム投稿
- 📅 定時投稿
- 💬 自動返信
- 📈 投稿統計
- 🔔 エラー通知
- ☁️ Google Cloud完全対応

---

## 🛠 Tech Stack

- Node.js（ESM, `node:test`）
- Playwright
- Google Cloud Run
- Google Cloud Scheduler
- Google Apps Script (GAS)
- Google Sheets（`googleapis`）

---

## 📂 Project Structure

```text
Project-X-Butler/
│
├── config/
│   └── config.example.json   # コピーして config/config.json を作る
├── logs/                     # 実行ログ（.gitignore 対象）
├── src/
│   ├── actions/              # repost / like（テストモード分岐込み）
│   ├── x/                    # login / profile / timeline（Playwright操作）
│   ├── browser.js            # ブラウザ起動・セッション再利用
│   ├── config.js             # ローカル設定 + Google Sheets 設定の読み込み
│   ├── keyword.js            # キーワード判定ロジック
│   ├── logger.js             # 実行ログ出力
│   └── index.js              # エントリーポイント（一連の処理を実行）
├── test/                     # node:test によるユニットテスト
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Setup

```bash
npm install
cp .env.example .env
cp config/config.example.json config/config.json
```

`.env` に X のログイン情報を設定します。

```
X_USERNAME=your-username-or-email
X_PASSWORD=your-password
TEST_MODE=true   # false にすると実際にリポスト/いいねを実行する
```

`config/config.json` でリポスト・いいねの対象キーワードや実行件数の上限を設定します（`config/config.example.json` 参照）。

## ▶️ Usage

```bash
npm start      # config.json / .env の設定に従って1回実行
npm test       # ユニットテスト実行（実ブラウザ・実X接続は不要）
```

`TEST_MODE=true`(既定値)のときは、キーワード判定とログ出力のみ行い、実際のクリック操作は行いません。本番実行前に必ずテストモードで動作を確認してください。

## ⚙️ Google Sheets 連携（任意）

`config.json` の `googleSheets.enabled` を `true` にすると、以下のシートから設定・キーワードを読み込みます（ローカルの `config.json` を上書き）。

- **Config シート**（`key`, `value` の2列）: `testMode` などの設定値
- **Keywords シート**（`action`, `keyword`, `enabled` の3列）: `action` は `repost` または `like`、`enabled` を `false` にするとその行を無視

サービスアカウントの認証情報ファイルへのパスを `.env` の `GOOGLE_SERVICE_ACCOUNT_FILE` に、対象スプレッドシートIDを `GOOGLE_SPREADSHEET_ID` に設定してください。サービスアカウントのメールアドレスをスプレッドシートの閲覧者として共有する必要があります。

---

## 🚀 Development Roadmap

### Day 1

- [x] GitHub リポジトリ作成
- [x] 開発環境準備
- [x] Git Clone
- [x] 初回コミット

### Day 2

- [x] npm 初期化
- [x] Playwright インストール
- [x] ブラウザ起動（`src/browser.js`）

### Day 3

- [x] X を開く
- [x] ログイン（`src/x/login.js`、実アカウントでの動作確認は未実施）

### Day 4

- [x] プロフィール取得（`src/x/profile.js`）
- [x] 投稿一覧取得（`src/x/timeline.js`）

### Day 5

- [x] キーワード判定（`src/keyword.js`）
- [x] テストモード実装（`TEST_MODE` / `config.testMode`）

### Day 6

- [x] 自動リポスト（`src/actions/repost.js`）

### Day 7

- [x] 自動いいね（`src/actions/like.js`）

---

## 🌹 Development Rules

- 1実装ごとにテストする
- 1実装ごとにGitへコミットする
- 既存システムを再利用して新機能を実装する
- スプレッドシートから設定を変更できるようにする
- 本番実行前に必ずテストモードで確認する

---

## 📄 License

GNU Affero General Public License v3.0
