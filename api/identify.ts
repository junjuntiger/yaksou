import { GoogleGenerativeAI } from '@google/generative-ai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mimeType } = req.body

  if (!imageBase64) {
    return res.status(400).json({ error: '画像がありません' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    }

    const prompt = `この画像の植物を識別してください。以下のJSON形式のみで回答してください（説明文は不要）：
{"name":"植物名（日本語）","category":"薬草","efficacy":"効能（100文字以内）","usage":"使い方（150文字以内）"}
categoryは必ず「薬草」「花」「雑草」のいずれかにしてください。
植物が判別できない場合や植物でない場合は{"error":"植物が見つかりません"}と返してください。`

    const result = await model.generateContent([prompt, imagePart])
    const text = result.response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(200).json({ error: '解析できませんでした' })
    }

    return res.status(200).json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'AI解析に失敗しました' })
  }
}
