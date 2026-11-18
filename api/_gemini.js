// Shared Gemini call. Returns parsed JSON or throws; callers fall back on any throw.
export async function askGemini(prompt, { timeoutMs = 6000 } = {}) {
  const key = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL
  if (!key || !model) throw new Error('gemini env not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // minimal thinking: ~1s instead of ~8s on 3.x flash-lite; budget 0 is rejected (400)
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4, thinkingConfig: { thinkingLevel: 'minimal' } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  if (!res.ok) throw new Error(`gemini http ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.candidates[0].content.parts[0].text)
}
