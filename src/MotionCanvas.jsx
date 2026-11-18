import { useEffect, useState } from 'react'
import { stateAt, duration, FALL_H, fallTime } from './sim.js'

const CAP = {
  push: 'Faint blocks mark where it was every 0.5 s. Equal gaps mean constant speed. Growing gaps mean speeding up.',
  fall: 'Faint circles mark every 0.25 s. Compare the two columns, and the arrows for each weight.',
  pair: 'Faint marks show where each skater was every 0.5 s. The two force arrows are the same size.',
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function Arrow({ x, y, len, cls, label }) {
  const d = Math.sign(len) * 8
  return (
    <g className={`mc-arrow ${cls}`}>
      <line x1={x} y1={y} x2={x + len} y2={y} />
      <polygon points={`${x + len},${y} ${x + len - d},${y - 5} ${x + len - d},${y + 5}`} />
      {label && <text x={x + len / 2} y={y - 8} textAnchor="middle">{label}</text>}
    </g>
  )
}
function VArrow({ x, y, len, cls, label }) { // vertical, pointing down for len > 0
  const d = Math.sign(len) * 8
  return (
    <g className={`mc-arrow ${cls}`}>
      <line x1={x} y1={y} x2={x} y2={y + len} />
      <polygon points={`${x},${y + len} ${x - 5},${y + len - d} ${x + 5},${y + len - d}`} />
      {label && <text x={x + 9} y={y + len / 2 + 4}>{label}</text>}
    </g>
  )
}

// One component, three scenario kinds. Positions come from the same simulator that makes the answer keys.
export default function MotionCanvas({ scenario: sc, runKey = 0 }) {
  const [t, setT] = useState(0)
  const [rk, setRk] = useState(0)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const D = duration(sc), k = slow ? 0.5 : 1
    if (reduced()) { setT(D); return }
    let raf; const t0 = performance.now()
    const tick = (now) => { const el = Math.min(((now - t0) / 1000) * k, D); setT(el); if (el < D) raf = requestAnimationFrame(tick) }
    setT(0); raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [JSON.stringify(sc), runKey, rk, slow])

  const s = stateAt(sc, t)
  const marks = (step) => Array.from({ length: Math.floor(t / step + 1e-9) }, (_, i) => (i + 1) * step)
  let body

  if (sc.kind === 'push') {
    const S = 18, bx = 150, w = 30 + sc.mass * 6, h = w * 0.62
    const off = (s.x * S) % 30
    body = (
      <>
        <line className="mc-ground" x1="0" y1="140" x2="360" y2="140" />
        {Array.from({ length: 13 }, (_, i) => <line key={i} className="mc-tick" x1={i * 30 - off} y1="140" x2={i * 30 - off} y2="147" />)}
        {marks(0.5).map((tk) => { const gx = bx + (stateAt(sc, tk).x - s.x) * S; return gx > -w && gx < 360 && <rect key={tk} className="mc-ghost" x={gx} y={140 - h - 6} width={w} height={h} rx="5" /> })}
        <rect className="mc-body" x={bx} y={140 - h - 6} width={w} height={h} rx="5" />
        <circle className="mc-wheel" cx={bx + 9} cy="137" r="5" /><circle className="mc-wheel" cx={bx + w - 9} cy="137" r="5" />
        <text className="mc-label inv" x={bx + w / 2} y={140 - h / 2 - 2} textAnchor="middle">{sc.mass} kg</text>
        {sc.force > 0 && <Arrow x={bx + w} y={140 - h / 2 - 6} len={Math.min(sc.force * 9, 90)} cls="force" label={`${sc.force} N`} />}
        {sc.friction > 0 && <Arrow x={bx} y={140 - h / 2 - 6} len={-Math.min(sc.friction * 9, 90)} cls="fric" label={`friction ${sc.friction} N`} />}
        {s.v > 0.05 && <Arrow x={bx + w / 2} y={140 - h - 24} len={Math.min(s.v * 14, 130)} cls="vel" label={`v = ${s.v.toFixed(1)}`} />}
        <text className="mc-read" x="12" y="22">speed {s.v.toFixed(1)} m/s</text>
        <text className="mc-read" x="12" y="40">distance {s.x.toFixed(1)} m</text>
      </>
    )
  } else if (sc.kind === 'fall') {
    const top = 22, bottom = 142
    const yy = (y, r) => top + (y / FALL_H) * (bottom - top - r)
    const cols = [[sc.m1, 170], [sc.m2, 290]]
    body = (
      <>
        <line className="mc-ground" x1="0" y1="150" x2="360" y2="150" />
        {cols.map(([m, x]) => {
          const r = 6 + m * 1.4, falling = t < fallTime()
          return (
            <g key={x}>
              {marks(0.25).map((tk) => <circle key={tk} className="mc-ghost" cx={x} cy={yy(stateAt(sc, tk).y1, r)} r={r} />)}
              <circle className={`mc-ball${falling ? '' : ' landed'}`} cx={x} cy={yy(s.y1, r)} r={r} />
              <text className="mc-label inv" x={x} y={yy(s.y1, r) + 4} textAnchor="middle">{m}</text>
              <VArrow x={x + r + 14} y={yy(s.y1, r) - 4} len={Math.min(10 + m * 4, 44)} cls="force" label={`${m * 10} N`} />
              <text className="mc-label" x={x} y="166" textAnchor="middle">{m} kg</text>
            </g>
          )
        })}
        <text className="mc-read" x="12" y="22">speed {s.v.toFixed(1)} m/s</text>
      </>
    )
  } else {
    const end = stateAt(sc, 4), k = 70 / Math.max(Math.abs(end.x1), Math.abs(end.x2), 1)
    const pushing = t <= 2, la = pushing ? Math.min(sc.force * 4, 60) : 0
    const wa = 20 + sc.m1 * 2.2, wb = 20 + sc.m2 * 2.2
    const P = (m, w, side, x) => { // skater: body + head
      const left = side < 0 ? 172 + x * k - w : 188 + x * k, ht = w * 1.5
      return (
        <g>
          <rect className={side < 0 ? 'mc-body' : 'mc-body b'} x={left} y={140 - ht} width={w} height={ht} rx="7" />
          <circle className={side < 0 ? 'mc-body' : 'mc-body b'} cx={left + w / 2} cy={140 - ht - 8} r="7" />
          <text className="mc-label inv" x={left + w / 2} y={140 - ht / 2 + 4} textAnchor="middle">{side < 0 ? 'A' : 'B'}</text>
          <text className="mc-label" x={left + w / 2} y="166" textAnchor="middle">{m} kg</text>
        </g>
      )
    }
    body = (
      <>
        <line className="mc-ground" x1="0" y1="140" x2="360" y2="140" />
        {marks(0.5).map((tk) => { const g = stateAt(sc, tk); return <g key={tk}><circle className="mc-ghost" cx={172 + g.x1 * k - wa / 2} cy="148" r="4" /><circle className="mc-ghost" cx={188 + g.x2 * k + wb / 2} cy="148" r="4" /></g> })}
        {P(sc.m1, wa, -1, s.x1)}{P(sc.m2, wb, 1, s.x2)}
        {la > 0 && <Arrow x={172 + s.x1 * k - wa} y={52} len={-la} cls="force" label={`${sc.force} N on A`} />}
        {la > 0 && <Arrow x={188 + s.x2 * k + wb} y={72} len={la} cls="fric" label={`${sc.force} N on B`} />}
        <text className="mc-read" x="12" y="22">A {Math.abs(s.v1).toFixed(1)} m/s</text>
        <text className="mc-read" x="12" y="40">B {s.v2.toFixed(1)} m/s</text>
      </>
    )
  }

  return (
    <figure className="mc-wrap">
      <svg className="mc" viewBox="0 0 360 175" role="img" aria-label="Animated motion demo">
        {body}
        <text className="mc-read r" x="348" y="22">t = {t.toFixed(1)} s</text>
      </svg>
      <div className="mc-ctrl">
        <button className="btn ghost sm" onClick={() => setRk((n) => n + 1)}>↻ Replay</button>
        <button className={`btn ghost sm${slow ? ' on' : ''}`} onClick={() => setSlow((v) => !v)} aria-pressed={slow}>Slow motion</button>
      </div>
      <figcaption>{CAP[sc.kind]}</figcaption>
    </figure>
  )
}
