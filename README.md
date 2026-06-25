# 🌿 薬草みっけ

薬草・野草・花のアーカイブアプリ。スマホで植物を撮影するとAIが自動識別し、みんなで記録を共有できます。

🔗 **公開URL**: https://yaksou.vercel.app

---

## 主な機能

| 機能 | 説明 |
|------|------|
| 📷 撮影・AI識別 | 写真を撮るとGemini AIが植物名・効能・使い方を自動識別 |
| 🌍 みんなの投稿 | 全ユーザーの記録をカテゴリ・地域・キーワードで検索 |
| 📖 マイ手帳 | 自分だけの植物記録を管理・編集 |
| ⚙️ 管理 | 統計・登録者一覧・投稿管理 |

---

## 技術スタック

### フロントエンド
- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)

### バックエンド・インフラ
- [Firebase Authentication](https://firebase.google.com/products/auth) — ログイン認証
- [Cloud Firestore](https://firebase.google.com/products/firestore) — データベース
- [Vercel Functions](https://vercel.com/docs/functions) — サーバーレスAPI（`api/identify.ts`）
- [Google Gemini 1.5 Flash](https://ai.google.dev/) — 植物識別AI

---

## 環境構築

詳細は [docs/環境構築手順.md](docs/環境構築手順.md) を参照。

```bash
git clone https://github.com/<your-username>/yaksou.git
cd yaksou
npm install
cp .env.example .env   # 環境変数を設定
npm run dev
```

---

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [要件定義書](docs/要件定義書.md) | 目的・対象ユーザー・機能要件 |
| [仕様書](docs/仕様書.md) | 画面一覧・機能詳細 |
| [データ設計書](docs/データ設計書.md) | Firestoreコレクション構造 |
| [API仕様書](docs/API仕様書.md) | Vercel Functions APIの仕様 |
| [セキュリティ設計](docs/セキュリティ設計.md) | 認証・APIキー管理・Firestoreルール |
| [環境構築手順](docs/環境構築手順.md) | ローカル開発環境のセットアップ |

---

## ライセンス

個人学習目的のプロジェクトです。
