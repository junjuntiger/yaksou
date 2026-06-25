# API仕様書 — 薬草みっけ

最終更新: 2026-06-25

---

## 概要

Vercel Functionsで実装されたサーバーレスAPIです。
ブラウザから直接Gemini APIを呼び出すとAPIキーが漏洩するため、サーバー側でキーを管理しプロキシとして機能します。

---

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/identify` | 植物画像をAIで識別する |

---

## POST /api/identify

### 概要

植物の画像データ（Base64エンコード）を受け取り、Google Gemini 1.5 Flashで識別した結果をJSONで返す。

### リクエスト

**ヘッダー**

```
Content-Type: application/json
```

**ボディ**

```json
{
  "imageBase64": "データURL全体またはBase64文字列",
  "mimeType": "image/jpeg"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `imageBase64` | string | ○ | Base64エンコードされた画像データ |
| `mimeType` | string | - | 画像のMIMEタイプ（省略時: `image/jpeg`） |

**対応MIMEタイプ**
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/heic`

### レスポンス

**成功時（識別できた場合）**

```json
HTTP 200 OK

{
  "name": "ヨモギ",
  "category": "薬草",
  "efficacy": "消炎・鎮痛・血行促進効果があります。",
  "usage": "お灸・天ぷら・よもぎ茶として利用できます。"
}
```

| フィールド | 型 | 説明 |
|-----------|---|------|
| `name` | string | 植物名（日本語） |
| `category` | string | `"薬草"` / `"花"` / `"雑草"` のいずれか |
| `efficacy` | string | 効能（100文字以内） |
| `usage` | string | 使い方（150文字以内） |

**成功時（識別できなかった場合）**

```json
HTTP 200 OK

{
  "error": "植物が見つかりません"
}
```

**エラーレスポンス**

| ステータス | 原因 | レスポンス |
|-----------|------|-----------|
| 400 | imageBase64が未指定 | `{"error": "画像がありません"}` |
| 405 | POST以外のメソッド | `{"error": "Method not allowed"}` |
| 500 | APIキー未設定 | `{"error": "APIキーが設定されていません"}` |
| 500 | Gemini API呼び出し失敗 | `{"error": "AI解析に失敗しました"}` |

---

## フロントエンドからの呼び出し例

```typescript
const response = await fetch('/api/identify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageBase64: base64Data,
    mimeType: file.type,
  }),
})

const result = await response.json()

if (result.error) {
  alert(result.error)
} else {
  // result.name, result.category, result.efficacy, result.usage を使用
}
```

---

## Geminiへのプロンプト

```
この画像の植物を識別してください。以下のJSON形式のみで回答してください（説明文は不要）：
{"name":"植物名（日本語）","category":"薬草","efficacy":"効能（100文字以内）","usage":"使い方（150文字以内）"}
categoryは必ず「薬草」「花」「雑草」のいずれかにしてください。
植物が判別できない場合や植物でない場合は{"error":"植物が見つかりません"}と返してください。
```

---

## 使用モデル

| 項目 | 値 |
|------|---|
| モデル | `gemini-1.5-flash` |
| プロバイダー | Google AI (Generative AI API) |
| 入力 | マルチモーダル（テキスト + 画像） |
| 出力 | テキスト（JSON形式） |

---

## セキュリティ

- `GEMINI_API_KEY` はVercelの環境変数に設定。コード・ブラウザには含まれない。
- リクエスト元の認証チェックは現在なし（今後Firebaseトークン検証を追加予定）
