// Decision rule, question generator (template side), local grader. Pure functions, no DOM.
import { TAGS, PACKAGE, PREREQ } from './bank.js'
import { pushState, pushOutcome, FALL_H, G, PAIR_T } from './sim.js'

export const LAW_TAGS = { 1: ['M1a', 'M1b'], 2: ['M2a', 'M2b'], 3: ['M3a', 'M3b'] }
export const TAG_KIND = { M1a: 'push', M1b: 'push', M2b: 'push', M2a: 'fall', M3a: 'pair', M3b: 'pair' }
export const MASTERY = 2 // first-try correct answers in a row on a tag
export const MAX_A = 6
export const RECAP_AT = 480 // s: skip new items, recap the weakest tag
export const END_AT = 600 // s: 10-minute budget
const PREREQ_FOR = { M1a: 'P-force', M1b: 'P-net', M2a: 'P-massweight', M2b: 'P-net', M3a: 'P-whichbody', M3b: 'P-whichbody' }
export const prereqFor = (tag) => PREREQ.find((p) => p.id === PREREQ_FOR[tag])

// Different wording/analogy from TAGS[tag].right, shown for the ALTERNATIVE EXPLANATION outcome.
export const ALT_EXPLAIN = {
  M1a: "Picture a puck on perfectly smooth ice. Only a push or pull can change its speed. If nothing acts along its path, its speed has nothing to change it, so it keeps gliding. Motion doesn't 'wear out'.",
  M1b: 'Balanced forces cancel their effect on speed, not the motion itself. A cyclist at steady speed pedals against air drag. The two balance, and the bike keeps rolling.',
  M2a: 'A heavier ball is pulled harder by the Earth, but it is also harder to speed up. The two effects cancel exactly, so every falling object gains 10 m/s each second.',
  M2b: 'A force does not hold a speed steady. It changes speed. Push a cart steadily and every second it gains the same extra speed (a = F/m).',
  M3a: 'The two forces act on two different bodies. To see if one body moves, add up only the forces on that body. Two skaters pushing off both slide away.',
  M3b: 'Each body gets the same size of force. But a = F/m, so the body with less mass gains more speed from the same force.',
}
export const HINTS = {
  M1a: ['What would have to push or pull the object to change its speed?', 'Is anything acting along its path? What does that tell you about the net force?'],
  M1b: ['Add up the forces on the object. What is the total?', 'If the total force is zero, does that tell you the object must be at rest?'],
  M2a: ['The Earth pulls a heavier ball harder. What else changes when the mass is bigger?', 'Think about a = F/m. What happens to a if both F and m get bigger by the same factor?'],
  M2b: ['What does a net force always cause, according to the second law?', 'If a force keeps acting, does the speed ever get a chance to stop changing?'],
  M3a: ['Which body does each of the two forces act on?', 'To decide if one skater moves, which forces would you add up?'],
  M3b: ['How do the two forces compare in size?', 'With equal forces, how does mass change the acceleration (a = F/m)?'],
}

const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const other = (m, lo, hi) => (m > lo ? m - 1 : m + 1) // any different mass in range

// Mirrors the server-side constraints, so a bad AI answer can never break the physics of a question.
export function normalizeParams(tag, p = {}) {
  switch (tag) {
    case 'M1a': return { kind: 'push', mass: num(p.mass, 1, 5, 2), force: 0, friction: 0, v0: num(p.v0, 1, 5, 3) }
    case 'M1b': { const f = num(p.force, 1, 4, 2); return { kind: 'push', mass: num(p.mass, 1, 5, 2), force: f, friction: f, v0: num(p.v0, 1, 5, 3) } }
    case 'M2b': return { kind: 'push', mass: num(p.mass, 1, 5, 2), force: num(p.force, 1, 10, 6), friction: 0, v0: 0 }
    case 'M2a': { const m1 = num(p.m1, 1, 10, 5); let m2 = num(p.m2, 1, 10, 1); if (m2 === m1) m2 = other(m1, 1, 10); return { kind: 'fall', m1, m2 } }
    case 'M3a': { const m = num(p.m1, 1, 10, 4); return { kind: 'pair', m1: m, m2: m, force: num(p.force, 2, 20, 8) } }
    default: { const m1 = num(p.m1, 1, 10, 2); let m2 = num(p.m2, 1, 10, 6); if (m2 === m1) m2 = other(m1, 1, 10); return { kind: 'pair', m1, m2, force: num(p.force, 2, 20, 12) } }
  }
}

const TEMPLATES = {
  M1a: [{ mass: 2, v0: 3 }, { mass: 3, v0: 2 }, { mass: 1, v0: 5 }, { mass: 4, v0: 4 }],
  M1b: [{ mass: 2, force: 2, v0: 2 }, { mass: 3, force: 3, v0: 3 }, { mass: 4, force: 4, v0: 1 }],
  M2b: [{ mass: 2, force: 6 }, { mass: 4, force: 8 }, { mass: 1, force: 4 }, { mass: 5, force: 10 }],
  M2a: [{ m1: 5, m2: 1 }, { m1: 2, m2: 8 }, { m1: 10, m2: 3 }],
  M3a: [{ m1: 4, force: 8 }, { m1: 6, force: 12 }, { m1: 3, force: 6 }],
  M3b: [{ m1: 2, m2: 6, force: 12 }, { m1: 8, m2: 2, force: 16 }, { m1: 3, m2: 9, force: 18 }],
}
export const templateParams = (tag, n = 0) => { const t = TEMPLATES[tag]; return normalizeParams(tag, t[n % t.length]) }

// Scenario memory: a learner never sees the same numbers twice (the AI at low temperature repeats itself).
export const sigOf = (p) => Object.entries(p).map(([k, v]) => `${k}=${v}`).join('|')
export const sigToParams = (s) => Object.fromEntries(s.split('|').map((kv) => { const [k, v] = kv.split('='); return [k, isNaN(v) ? v : Number(v)] }))
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const randomParams = (tag) => ({
  M1a: () => ({ mass: rnd(1, 5), v0: rnd(1, 5) }), M1b: () => ({ mass: rnd(1, 5), force: rnd(1, 4), v0: rnd(1, 5) }),
  M2b: () => ({ mass: rnd(1, 5), force: rnd(1, 10) }), M2a: () => ({ m1: rnd(1, 10), m2: rnd(1, 10) }),
  M3a: () => ({ m1: rnd(1, 10), force: rnd(2, 20) }), M3b: () => ({ m1: rnd(1, 10), m2: rnd(1, 10), force: rnd(2, 20) }),
}[tag]())
export function unseenParams(tag, params, seen = [], n = 0) {
  const fresh = (p) => !seen.includes(sigOf(p))
  let p = normalizeParams(tag, params)
  if (fresh(p)) return p
  for (let i = 1; i <= TEMPLATES[tag].length; i++) { p = templateParams(tag, n + i); if (fresh(p)) return p }
  for (let i = 0; i < 40; i++) { p = normalizeParams(tag, randomParams(tag)); if (fresh(p)) return p }
  return normalizeParams(tag, params) // everything seen (very long session): repeat rather than fail
}
export const scenarioForTag = (tag) => templateParams(tag, 0)

export function facts(p) {
  if (p.kind === 'push')
    return `A ${p.mass} kg block ${p.v0 ? `moves at ${p.v0} m/s` : 'starts at rest'} on a flat surface. Pushing force: ${p.force} N forward. Friction: ${p.friction} N backward.`
  if (p.kind === 'fall') return `Two balls, ${p.m1} kg and ${p.m2} kg, are dropped together from ${FALL_H} m. Ignore air.`
  return `Skater A (${p.m1} kg) and skater B (${p.m2} kg) stand on smooth ice and push each other with a ${p.force} N force for ${PAIR_T} s.`
}

const r1 = (x) => Math.round(x * 10) / 10
const OPT = {
  push: [['constant', 'It keeps the same speed'], ['speeds', 'It speeds up steadily'], ['slows', 'It slows down'], ['rest', 'It stays at rest']],
  fall: [['heavy', 'The heavier ball lands first'], ['light', 'The lighter ball lands first'], ['same', 'They land together']],
  apart: [['apart', 'Both skaters slide apart'], ['none', 'Neither moves, because the forces cancel'], ['one', 'Only one skater moves']],
  acc: [['light', 'The lighter skater'], ['heavy', 'The heavier skater'], ['same', 'Both the same']],
}

// Merge cues/keywords for a tag from the fixed bank so generated explain items reuse reviewed vocabulary.
function rubricFor(tag) {
  const cues = new Set(), kws = new Set()
  for (const it of Object.values(PACKAGE).flat()) {
    if (!it.rubric) continue
    ;(it.rubric.cues[tag] || []).forEach((c) => cues.add(c))
    if (it.tags.includes(tag)) it.rubric.keywords.forEach((k) => kws.add(k))
  }
  return { keyPoints: [TAGS[tag].right], cues: { [tag]: [...cues] }, keywords: [...kws] }
}

// What actually happens in this exact scenario, computed by the simulator. Given to the grader as ground truth.
function referenceFor(p) {
  if (p.kind === 'push') {
    const net = p.force - p.friction
    return {
      constant: `Net force is ${net} N, so the block keeps moving at ${p.v0} m/s (constant velocity).`,
      speeds: `Net force is ${net} N forward, so a = ${r1(net / p.mass)} m/s² and the speed keeps increasing.`,
      slows: `Net force is ${-net} N backward, so the block slows down at ${r1(-net / p.mass)} m/s².`,
      rest: 'The push is not larger than friction, so the block stays at rest.',
    }[pushOutcome(p)]
  }
  if (p.kind === 'fall') return 'Both balls have the same acceleration, g = 10 m/s², so they land together whatever their masses.'
  return `The two forces are equal (${p.force} N) and act on different bodies. Both skaters accelerate: A at ${r1(p.force / p.m1)} m/s², B at ${r1(p.force / p.m2)} m/s². The lighter one accelerates more.`
}

export function buildItem(tag, format, params, story, source, n = 0) {
  const p = normalizeParams(tag, params)
  const base = { id: `A${n}-${tag}-${format}`, phase: 'A', tag, format, params: p, facts: facts(p), story: story || '', source, hints: HINTS[tag] }
  if (format === 'numeric') {
    let q, a, unit
    if (p.kind === 'push' && p.v0 > 0) { q = 'How far does the block travel in 3 s? (metres, 1 decimal place)'; a = pushState(p, 3).x; unit = 'm' }
    else if (p.kind === 'push') { q = "What is the block's speed after 3 s? (m/s, 1 decimal place)"; a = pushState(p, 3).v; unit = 'm/s' }
    else if (p.kind === 'fall') { q = "What is a ball's speed after 1.5 s of falling? (m/s)"; a = G * 1.5; unit = 'm/s' }
    else { q = "What is skater A's acceleration? (m/s², 1 decimal place)"; a = p.force / p.m1; unit = 'm/s²' }
    return { ...base, question: q, answer: r1(a), tolerance: 0.15, unit, reveal: `${r1(a)} ${unit}` }
  }
  if (format === 'explain')
    return { ...base, question: 'Predict what will happen and explain why, in one or two sentences.', rubric: rubricFor(tag), reference: referenceFor(p), reveal: referenceFor(p) }
  let options, answer, question
  if (p.kind === 'push') { options = OPT.push; answer = pushOutcome(p); question = "What happens to the block's speed during the next 4 seconds?" }
  else if (p.kind === 'fall') { options = OPT.fall; answer = 'same'; question = 'Which ball lands first?' }
  else if (tag === 'M3a') { options = OPT.apart; answer = 'apart'; question = 'What happens to the skaters?' }
  else { options = OPT.acc; answer = 'light'; question = 'Which skater has the larger acceleration?' }
  const opts = options.map(([id, text]) => ({ id, text, tag: id === answer ? null : tag }))
  return { ...base, question, options: opts, answer, reveal: opts.find((o) => o.id === answer).text }
}

export function templateItem(tag, format, n = 0, seen = []) {
  return buildItem(tag, format, unseenParams(tag, templateParams(tag, n), seen, n), '', 'template', n)
}

// Words to box in built-in hints, and when the AI proposes none. Longest/most specific first.
const GLOSS = ['net force', 'different bod(?:y|ies)', 'equal', 'opposite', 'balanced', 'faster', 'heavier', 'lighter', 'same (?:time|height|rate)', 'accelerat\\w*', 'friction', 'gravity', 'weight', 'mass', 'push(?:ing)?|pull(?:ing)?', 'speed', 'land(?:s)?', 'force']
export function autoHighlight(text) {
  const out = []
  for (const g of GLOSS) {
    const m = String(text).match(new RegExp(g, 'i'))
    if (m && !out.some((o) => o.toLowerCase().includes(m[0].toLowerCase()))) out.push(m[0]) // skip a word already inside a picked phrase
    if (out.length === 3) break
  }
  return out
}
const GENERIC =['faster', 'speed', 'velocity', 'constant', 'same', 'equal', 'opposite', 'different bod', 'accelerat', 'mass', 'weight', 'force', 'inertia', 'friction', 'keeps']
// Keyword grader used when the AI is unavailable (and as a sanity net). Lenient on wording.
export function gradeLocal(text, rubric, tag) {
  const t = (text || '').toLowerCase().trim()
  if (t.length < 3) return { correct: false, tag: null, feedback: 'Try writing one or two sentences about what you expect and why.' }
  const hit = Object.entries(rubric.cues || {}).find(([, cs]) => cs.some((c) => t.includes(c) && !t.includes(`not ${c}`) && !t.includes(`n't ${c}`)))
  // Generic physics words too: the AI-down fallback must not fail correct answers that use everyday wording.
  const kw = [...(rubric.keywords || []), ...GENERIC].filter((k) => t.includes(k)).length
  const correct = !hit && kw >= 1
  return {
    correct, tag: correct ? null : (hit?.[0] || tag || null),
    feedback: correct ? 'Good. You used the key idea.' : 'Think about which forces act on the object, and what the net force does to its motion.',
  }
}

export function newState(law, demo) {
  const tags = LAW_TAGS[law]
  const st = { law, phase: 'A', strikes: Object.fromEntries(tags.map((t) => [t, 0])), gate: Object.fromEntries(tags.map((t) => [t, 0])),
    streak: 0, explained: {}, seen: [], aCount: 0, bIdx: 0, nextTag: null, nextFormat: null, lastTag: null, recapped: false, elapsed: 0, results: [] }
  if (demo === 'harder') st.streak = 1 // first first-try correct answer triggers HARDER
  if (demo === 'prereq') tags.forEach((t) => (st.strikes[t] = 1)) // first miss triggers PREREQ
  return st
}

const pickTag = (st, open) => [...open].sort((a, b) => (st.strikes[b] - st.strikes[a]) || ((a === st.lastTag) - (b === st.lastTag)))[0]
const label = (tag) => TAGS[tag].label

// THE DECISION RULE. Exactly one outcome per finished item:
//   HARDER  : correct first try and streak >= 2          -> next task numeric (harder)
//   ALT     : miss on a tag, strikes[tag] == 1           -> animation + different explanation, fresh question
//   PREREQ  : miss on a tag, strikes[tag] == 2           -> prerequisite lesson, then re-test
//   ALT (3+): strikes[tag] >= 3 -> do not repeat the lesson; next task is an explain item (nature changes)
//   NEXT    : otherwise (correct choice with no explanation yet -> next task is an explain item)
export function decide(st, item, res) {
  const s = structuredClone(st)
  const tag = res.tag || item.tag || item.tags?.[0] || null
  s.results.push({ id: item.id, phase: item.phase, tag: item.tag || item.tags?.[0] || null, format: item.format, correct: res.correct, firstTry: res.firstTry })
  s.lastTag = item.tag || s.lastTag
  let outcome = { type: 'NEXT', tag, reason: 'Keep going.' }
  if (res.correct) {
    s.streak = res.firstTry ? s.streak + 1 : 0
    if (item.phase === 'A') {
      s.gate[item.tag] = res.firstTry ? s.gate[item.tag] + 1 : 0
      if (item.format === 'explain') s.explained[item.tag] = true
    }
    if (item.phase === 'A' && res.firstTry && s.streak >= 2) { // Phase B is a fixed package: nothing harder follows, so do not claim it
      s.streak = 0; s.nextFormat = 'numeric'
      outcome = { type: 'HARDER', tag, reason: 'Two correct first tries in a row, so the next task is harder (a numeric answer).' }
    } else if (item.phase === 'A' && item.format === 'choice' && res.firstTry && !s.explained[item.tag]) {
      s.nextTag = item.tag; s.nextFormat = 'explain'
      outcome = { type: 'NEXT', tag, reason: 'Correct choice, but guessing is possible, so the next task asks for your reasoning.' }
    }
  } else if (tag) {
    s.streak = 0; s.strikes[tag] = (s.strikes[tag] || 0) + 1
    if (s.gate[tag] !== undefined) s.gate[tag] = 0
    s.nextTag = tag; s.nextFormat = 'choice'
    const k = s.strikes[tag]
    if (k >= 3) { // the same lesson again would not help: change the nature of the task instead of looping
      s.nextFormat = 'explain'
      outcome = { type: 'ALT', tag, reason: `Still tricky after ${k} misses on "${label(tag)}". Next, explain it in your own words and we will work from your reasoning. Stopping for today is also fine.` }
    } else outcome = k === 2
      ? { type: 'PREREQ', tag, reason: `Second miss on "${label(tag)}", so go back to the prerequisite lesson before trying again.` }
      : { type: 'ALT', tag, reason: `First miss on "${label(tag)}", so here is a different explanation, then a fresh question on the same idea.` }
  } else s.streak = 0
  if (item.phase === 'B') { s.bIdx += 1; if (!(item.kind === 'tricky' && !res.correct)) { s.nextTag = null; s.nextFormat = null } }
  return { state: s, outcome }
}

export function nextStep(st) {
  if (st.elapsed >= END_AT || st.recapped) return { kind: 'done' }
  if (st.elapsed >= RECAP_AT) return { kind: 'recap' }
  if (st.nextTag) return { kind: 'A', tag: st.nextTag, format: st.nextFormat || 'choice' }
  if (st.phase === 'A') {
    const open = LAW_TAGS[st.law].filter((t) => st.gate[t] < MASTERY)
    if (open.length && st.aCount < MAX_A) return { kind: 'A', tag: pickTag(st, open), format: st.nextFormat || 'choice' }
  }
  const items = PACKAGE[st.law]
  return st.bIdx < items.length ? { kind: 'B', item: items[st.bIdx] } : { kind: 'done' }
}

// Apply the step to state (clears the one-shot nextTag/nextFormat, counts items).
export function consume(st, step) {
  const s = structuredClone(st)
  s.nextTag = null; s.nextFormat = null
  if (step.kind === 'A') s.aCount += 1
  if (step.kind === 'B') s.phase = 'B'
  if (step.kind === 'recap') s.recapped = true
  return s
}

export const weakestTag = (st) => Object.entries(st.strikes).sort((a, b) => b[1] - a[1])[0][0]
