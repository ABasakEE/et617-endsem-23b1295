// Run: node --env-file=.env.local scripts/test-gemini.mjs
// Sends only generic physics prompts: no names, emails or roll numbers.
import { askGemini } from '../api/_gemini.js'

const t0 = Date.now()
const ping = await askGemini('Return JSON {"ok":true}', { timeoutMs: 15000 })
console.log('ping ok:', ping.ok === true, `${Date.now() - t0}ms`)

const t1 = Date.now()
const gen = await askGemini(
  'Pick scenario numbers for a Class 9 physics question that probes the misconception ' +
    '"a constant force gives constant speed". Return JSON {"mass":kg 1-5,"force":N 1-10,"friction":N 0-2,"v0":m/s 0-3,"question":short text}.',
  { timeoutMs: 15000 },
)
console.log('generate:', JSON.stringify(gen), `${Date.now() - t1}ms`)
for (const [k, lo, hi] of [['mass', 1, 5], ['force', 1, 10], ['friction', 0, 2], ['v0', 0, 3]])
  if (!(gen[k] >= lo && gen[k] <= hi)) throw new Error(`out of range: ${k}`)
console.log('range check ok')
