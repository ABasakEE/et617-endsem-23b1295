// Thin client for the AI endpoints. Any failure throws; callers fall back to local logic.
const OFFLINE = new URLSearchParams(location.search).has('offline') // demo switch: force fallbacks
async function post(path, body, ms) {
  if (OFFLINE) throw new Error('offline')
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`http ${r.status}`)
  return r.json()
}
export const generate = (b) => post('/api/generate', b, 16000)
export const feedback = (b) => post('/api/feedback', b, 16000)
export const grade = (b) => post('/api/grade', b, 16000)
