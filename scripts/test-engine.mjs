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
