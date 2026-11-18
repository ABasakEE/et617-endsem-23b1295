// Simulator = answer key for every generated question (the LLM never decides physics).
// Scenario kinds: push {mass,force,friction,v0} | fall {m1,m2} | pair {m1,m2,force}. g = 10 m/s^2.
export const G = 10
export const FALL_H = 20 // m
export const PUSH_T = 4 // s horizon used by choice questions
export const PAIR_T = 2 // s the pair pushes each other

// Euler integration is plenty for these ranges. Friction opposes motion; net<=0 at rest means no motion.
export function pushState(s, t) {
  let x = 0, v = s.v0
  const dt = 0.01, n = Math.round(t / dt)
  for (let i = 0; i < n; i++) {
    v = Math.max(0, v + ((s.force - s.friction) / s.mass) * dt)
    x += v * dt
  }
  const moving = v > 0 || s.force > s.friction
  return { x, v, a: moving ? (s.force - s.friction) / s.mass : 0 }
}

// Outcome class for a push scenario after PUSH_T seconds.
export function pushOutcome(s) {
  const { v } = pushState(s, PUSH_T)
  if (s.v0 === 0 && v < 0.01) return 'rest'
  if (Math.abs(v - s.v0) < 0.05) return 'constant'
  return v > s.v0 ? 'speeds' : 'slows'
}

export const fallTime = () => Math.sqrt((2 * FALL_H) / G) // same for any mass

// Positions/velocities at time t for drawing (and for numeric keys).
export function stateAt(sc, t) {
  if (sc.kind === 'push') return pushState(sc, t)
  if (sc.kind === 'fall') {
    const tt = Math.min(t, fallTime())
    return { y1: 0.5 * G * tt * tt, y2: 0.5 * G * tt * tt, v: G * tt }
  }
  const a1 = sc.force / sc.m1, a2 = sc.force / sc.m2
  const tp = Math.min(t, PAIR_T)
  const v1 = a1 * tp, v2 = a2 * tp
  return { x1: -(0.5 * a1 * tp * tp + v1 * (t - tp)), x2: 0.5 * a2 * tp * tp + v2 * (t - tp), v1, v2, a1, a2 }
}

export const duration = (sc) => (sc.kind === 'push' ? 5 : sc.kind === 'fall' ? fallTime() + 0.4 : 4)
