# 🌹 Project X Butler

Project X Butler は、X（旧Twitter）の運用を支援する自動化Botです。

Google Cloud、Playwright、Google Apps Script（GAS）、Google スプレッドシートを利用し、ルールに従って自動で投稿やリアクションを行います。

> **Project X Butler は、運用ルールをコードではなく設定で管理し、誰でも扱いやすい X 自動化Bot を目指すプロジェクトです。**

---

## ✨ Features

### v1.0（開発中）

- 🔁 キーワードによる自動リポスト
- ❤️ キーワードによる自動いいね
- 📊 実行ログ保存
- ⚙️ スプレッドシートによる設定管理

### 🚀 Planned Features

- 📝 ランダム投稿
- 📅 定時投稿
- 💬 自動返信
- 📈 投稿統計
- 🔔 エラー通知
- ☁️ Google Cloud完全対応

---

## 🛠 Tech Stack

- Node.js
- Playwright
- Google Cloud Run
- Google Cloud Scheduler
- Google Apps Script (GAS)
- Google Sheets

---

## 📂 Project Structure

```text
Project-X-Butler/
│
├── config/
├── logs/
├── src/
├── test/
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Development Roadmap

### Day 1

- [x] GitHub リポジトリ作成
- [x] 開発環境準備
- [x] Git Clone
- [x] 初回コミット

### Day 2

- [ ] npm 初期化
- [ ] Playwright インストール
- [ ] ブラウザ起動

### Day 3

- [ ] X を開く
- [ ] ログイン

### Day 4

- [ ] プロフィール取得
- [ ] 投稿一覧取得

### Day 5

- [ ] キーワード判定
- [ ] テストモード実装

### Day 6

- [ ] 自動リポスト

### Day 7

- [ ] 自動いいね

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