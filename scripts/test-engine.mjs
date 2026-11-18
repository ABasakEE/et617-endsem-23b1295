import assert from 'node:assert'
import { pushOutcome, pushState } from '../src/sim.js'
import { templateItem, normalizeParams, decide, nextStep, consume, newState, gradeLocal, LAW_TAGS, TAG_KIND } from '../src/engine.js'

// answer keys
assert.equal(pushOutcome({ kind: 'push', mass: 2, force: 0, friction: 0, v0: 3 }), 'constant')
assert.equal(pushOutcome({ kind: 'push', mass: 2, force: 3, friction: 3, v0: 2 }), 'constant')
assert.equal(pushOutcome({ kind: 'push', mass: 2, force: 6, friction: 0, v0: 0 }), 'speeds')
assert.equal(pushOutcome({ kind: 'push', mass: 2, force: 0, friction: 2, v0: 3 }), 'slows')
assert.equal(pushOutcome({ kind: 'push', mass: 2, force: 1, friction: 2, v0: 0 }), 'rest')
assert.ok(Math.abs(pushState({ mass: 2, force: 6, friction: 0, v0: 0 }, 3).v - 9) < 0.05)

// every tag x format builds a valid item, key matches simulator
for (const tags of Object.values(LAW_TAGS)) for (const tag of tags) for (const f of ['choice', 'numeric', 'explain']) for (let n = 0; n < 4; n++) {
  const it = templateItem(tag, f, n)
  assert.equal(it.params.kind, TAG_KIND[tag]); assert.ok(it.question && it.facts)
  if (f === 'choice') { assert.equal(it.options.filter((o) => o.id === it.answer).length, 1); assert.equal(it.options.find((o) => o.id === it.answer).tag, null) }
  if (f === 'numeric') assert.ok(Number.isFinite(it.answer))
  if (f === 'explain') assert.ok(it.rubric.keywords.length > 0)
}
// bad AI params get repaired
assert.equal(normalizeParams('M1a', { mass: 99, force: 7, friction: 9, v0: -4 }).force, 0)
assert.notEqual(normalizeParams('M3b', { m1: 5, m2: 5, force: 8 }).m2, 5)

// decision rule: three outcomes
let st = newState(1)
const it = templateItem('M1a', 'choice', 0)
let d = decide(st, it, { correct: false, firstTry: false }); assert.equal(d.outcome.type, 'ALT')
d = decide(d.state, it, { correct: false, firstTry: false }); assert.equal(d.outcome.type, 'PREREQ')
st = newState(1, 'harder')
d = decide(st, it, { correct: true, firstTry: true }); assert.equal(d.outcome.type, 'HARDER'); assert.equal(d.state.nextFormat, 'numeric')
st = newState(1)
d = decide(st, it, { correct: true, firstTry: true }); assert.equal(d.outcome.type, 'NEXT'); assert.equal(nextStep(d.state).format, 'explain')

// session reaches phase B then done; time rule
st = newState(1); st.gate.M1a = 2; st.gate.M1b = 2
assert.equal(nextStep(st).kind, 'B')
st.elapsed = 500; assert.equal(nextStep(st).kind, 'recap'); st = consume(st, { kind: 'recap' }); assert.equal(nextStep(st).kind, 'done')

// local grader
const rub = templateItem('M1a', 'explain', 0).rubric
assert.equal(gradeLocal('no net force so constant velocity, inertia', rub, 'M1a').correct, true)
assert.equal(gradeLocal('the force runs out so it stops', rub, 'M1a').tag, 'M1a')
console.log('engine OK')

// no scenario repeats: 15 consecutive items on one tag all have different numbers
import { sigOf, unseenParams } from '../src/engine.js'
for (const tag of ['M1a', 'M2b', 'M3b']) {
  const seen = []
  for (let i = 0; i < 15; i++) { const it = templateItem(tag, 'choice', i, seen); const s = sigOf(it.params); assert.ok(!seen.includes(s), `repeat ${tag} ${s}`); seen.push(s) }
}
assert.ok(!['kind=push|mass=2|force=0|friction=0|v0=3'].includes(sigOf(unseenParams('M1a', { mass: 2, v0: 3 }, ['kind=push|mass=2|force=0|friction=0|v0=3']))))
// explain items carry the simulator's reference outcome
assert.match(templateItem('M2b', 'explain', 0).reference, /speed keeps increasing/)
assert.match(templateItem('M2a', 'explain', 0).reference, /land together/)
console.log('engine no-repeat OK')

// AI-down fallback grader: everyday wording passes, misconception cues still fail
const r2 = templateItem('M2b', 'explain', 0).rubric
assert.equal(gradeLocal('it will go faster and faster because the force keeps pushing it', r2, 'M2b').correct, true)
assert.equal(gradeLocal('it reaches a steady speed because the force is constant', r2, 'M2b').correct, false)
assert.equal(gradeLocal('banana', r2, 'M2b').correct, false)
console.log('fallback grader OK')

// hint highlighting: glossary fallback finds idea words, never more than 3
import { autoHighlight } from '../src/engine.js'
assert.deepEqual(autoHighlight('Does a heavier ball fall faster? Think about the net force.'), ['net force', 'faster', 'heavier'])
assert.ok(autoHighlight('force force mass speed weight friction').length <= 3)
console.log('highlight OK')

// HARDER is a Phase A promise only (Phase B is fixed)
{
  const b = { ...templateItem('M1a', 'choice', 0), phase: 'B', kind: 'standard' }
  const st = newState(1, 'harder')
  assert.equal(decide(st, b, { correct: true, firstTry: true }).outcome.type, 'NEXT')
  console.log('phase B no false HARDER OK')
}

// no endless prerequisite loop: 1st ALT, 2nd PREREQ, 3rd+ switches the task to explain
{
  const it = templateItem('M1a', 'choice', 0); let st = newState(1), types = []
  for (let i = 0; i < 4; i++) { const d = decide(st, it, { correct: false, firstTry: false }); st = d.state; types.push(d.outcome.type) }
  assert.deepEqual(types, ['ALT', 'PREREQ', 'ALT', 'ALT'])
  assert.equal(nextStep(st).format, 'explain')
  assert.ok(autoHighlight('Does a heavier ball land first?').length >= 2)
  console.log('no prereq loop OK')
}
