import { askGemini } from './_gemini.js'

const TAGS = { M1a: 'push', M1b: 'push', M2a: 'fall', M2b: 'push', M3a: 'pair', M3b: 'pair' }
const FORMATS = ['choice', 'numeric', 'explain']
const RANGES = {
  push: { mass: [1, 5], force: [0, 10], friction: [0, 4], v0: [0, 5] },
  fall: { m1: [1, 10], m2: [1, 10] },
  pair: { m1: [1, 10], m2: [1, 10], force: [2, 20] },
}
const TAG_RULES = {
  M1a: 'force must be 0, friction must be 0, v0 between 1 and 5 (a body already moving, nothing acting on it).',
  M1b: 'force must equal friction, both between 1 and 4, v0 between 1 and 5 (forces balance).',
  M2a: 'two objects of different mass dropped together, m1 and m2 must differ.',
  M2b: 'v0 must be 0, friction must be 0, force between 1 and 10 (starts at rest, pushed).',
  M3a: 'm1 must equal m2 (two equal masses pushing/pulling each other).',
  M3b: 'm1 must differ from m2 (two unequal masses pushing/pulling each other).',
}
const ASK = {
  choice: 'a "what happens?" question with choices to follow (do not list choices)',
  numeric: 'a question asking the learner to calculate one number (a speed in m/s or an acceleration in m/s^2)',
  explain: 'a request to predict what happens and explain why',
}
const UNITS = 'mass in kg, force and friction in N, v0 in m/s'

const clamp = (v, [lo, hi]) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined
}

function buildParams(tag, kind, raw) {
  const p = {}
  for (const [k, r] of Object.entries(RANGES[kind])) p[k] = clamp(raw?.[k], r)
  // The tag decides the scenario shape, so these override whatever the model chose.
  if (tag === 'M1a') Object.assign(p, { force: 0, friction: 0, v0: clamp(p.v0, [1, 5]) })
  if (tag === 'M1b') {
    const f = clamp(p.force, [1, 4])
    Object.assign(p, { force: f, friction: f, v0: clamp(p.v0, [1, 5]) })
  }
  if (tag === 'M2b') Object.assign(p, { v0: 0, friction: 0, force: clamp(p.force, [1, 10]) })
  if (tag === 'M3a') p.m2 = p.m1
  const ok = Object.values(p).every(Number.isFinite) && (kind === 'push' || (tag === 'M3a') === (p.m1 === p.m2))
  return ok ? p : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  let b = req.body
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = null } }
  const { tag, format, recent } = b || {}
  if (!Object.hasOwn(TAGS, tag) || !FORMATS.includes(format) || !['push', 'fall', 'pair'].includes(b.kind))
    return res.status(400).json({ error: 'bad_request' })
  if (recent !== undefined && !(Array.isArray(recent) && recent.length <= 6)) return res.status(400).json({ error: 'bad_request' })

  const kind = TAGS[tag] // tag wins over a mismatching body.kind
  const keys = Object.entries(RANGES[kind]).map(([k, [lo, hi]]) => `"${k}": integer ${lo}-${hi}`).join(', ')
  const recentTags = (recent || []).map((r) => String(r?.tag ?? '').slice(0, 8)).join(', ') || 'none'
  // Number sets already shown to this learner. The client also enforces this, but asking avoids wasted calls.
  const avoid = (Array.isArray(b.avoid) ? b.avoid.slice(-8) : []).filter((a) => a && typeof a === 'object')
    .map((a) => JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== 'kind' && Number.isFinite(v))))).join('; ')
  const prompt = `You write short physics questions for a Class 9 learner. Use simple English and short sentences. Audience is calm and encouraging.
Topic: Newton's laws of motion. Scenario type: ${kind} (${UNITS}).
Scenario rule: ${TAG_RULES[tag]}
Choose integer numbers within these ranges: ${keys}.
Write a 1-2 sentence scenario stem that mentions the chosen numbers with units.
The stem must NOT state the outcome or the answer. It must end with ${ASK[format]}.
Vary the scenario (objects, setting) from earlier questions. Earlier question tags: ${recentTags}.
${avoid ? `Do NOT reuse any of these number sets, pick clearly different values: ${avoid}.\n` : ''}Variation seed: ${Math.floor(Math.random() * 1e6)}.
Use generic objects only (cart, box, ball, trolley). No names of people.
Return JSON only: {"params": {${keys}}, "stem": "..."}`

  try {
    const out = await askGemini(prompt, { timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 14000, temperature: 1.0 })
    const params = buildParams(tag, kind, out?.params)
    const stem = typeof out?.stem === 'string' ? out.stem.trim() : ''
    if (!params || stem.length < 10 || stem.length > 400) throw new Error('unusable')
    return res.status(200).json({ params, stem })
  } catch {
    return res.status(502).json({ error: 'ai_unavailable' })
  }
}
