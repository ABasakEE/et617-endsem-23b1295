// Shared Gemini call. Returns parsed JSON or throws; callers fall back on any throw.
// system: optional system instruction. thinking: 'minimal' is ~1-8 s on the free tier; budget 0 is rejected (400).
export async function askGemini(prompt, { timeoutMs = 6000, system, temperature = 0.4, thinking = 'minimal' } = {}) {
  const key = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL
  if (!key || !model) throw new Error('gemini env not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature, thinkingConfig: { thinkingLevel: thinking } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  if (!res.ok) throw new Error(`gemini http ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.candidates[0].content.parts[0].text)
}
