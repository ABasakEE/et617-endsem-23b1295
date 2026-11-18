import { useEffect, useState } from 'react'
import { stateAt, duration, FALL_H, PAIR_T } from './sim.js'

// One component, three scenario kinds. Positions come from the same simulator that makes the answer keys.
export default function MotionCanvas({ scenario: sc, runKey = 0 }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let raf, t0 = performance.now()
    const D = duration(sc)
    const tick = (now) => {
      const el = Math.min((now - t0) / 1000, D)
      setT(el)
      if (el < D) raf = requestAnimationFrame(tick)
    }
    setT(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [JSON.stringify(sc), runKey])

  const s = stateAt(sc, t)
  const svg = { width: '100%', maxWidth: 420, background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: 8 }
  const Arrow = ({ x, y, len, color, label }) => (
    <g stroke={color} fill={color} strokeWidth="3">
      <line x1={x} y1={y} x2={x + len} y2={y} />
      <polygon points={`${x + len},${y} ${x + len - Math.sign(len) * 8},${y - 5} ${x + len - Math.sign(len) * 8},${y + 5}`} />
      <text x={x + len / 2} y={y - 8} fontSize="11" stroke="none" textAnchor="middle">{label}</text>
    </g>
  )

  if (sc.kind === 'push') {
    const w = 30 + sc.mass * 6, off = (s.x * 18) % 30
    const fl = Math.min(sc.force * 9, 90), fr = Math.min(sc.friction * 9, 90)
    return (
      <svg viewBox="0 0 360 170" style={svg} role="img" aria-label="Block on a surface">
        <line x1="0" y1="130" x2="360" y2="130" stroke="#57606a" />
        {Array.from({ length: 13 }, (_, i) => <line key={i} x1={i * 30 - off} y1="130" x2={i * 30 - off} y2="138" stroke="#57606a" />)}
        <rect x={130} y={130 - w * 0.7} width={w} height={w * 0.7} fill="#0969da" />
        <text x={130 + w / 2} y={130 - w * 0.25} fill="#fff" fontSize="12" textAnchor="middle">{sc.mass} kg</text>
        {sc.force > 0 && <Arrow x={130 + w} y={95 - w * 0.2} len={fl} color="#1a7f37" label={`${sc.force} N`} />}
        {sc.friction > 0 && <Arrow x={130} y={115} len={-fr} color="#cf222e" label={`friction ${sc.friction} N`} />}
        <text x="10" y="20" fontSize="13">speed: {s.v.toFixed(1)} m/s</text>
        <text x="10" y="38" fontSize="13">distance: {s.x.toFixed(1)} m</text>
        <text x="350" y="20" fontSize="12" textAnchor="end">t = {t.toFixed(1)} s</text>
      </svg>
    )
  }

  if (sc.kind === 'fall') {
    const y = (m) => 15 + (s.y1 / FALL_H) * 105
    const r = (m) => 6 + m * 1.4
    return (
      <svg viewBox="0 0 360 170" style={svg} role="img" aria-label="Two balls falling">
        <line x1="0" y1="145" x2="360" y2="145" stroke="#57606a" />
        {[[sc.m1, 110], [sc.m2, 250]].map(([m, x]) => (
          <g key={x}><circle cx={x} cy={y(m)} r={r(m)} fill="#bf3989" /><text x={x} y={y(m) + 4} fontSize="10" fill="#fff" textAnchor="middle">{m}</text>
          <text x={x} y="162" fontSize="11" textAnchor="middle">{m} kg</text></g>
        ))}
        <text x="10" y="20" fontSize="13">speed: {s.v.toFixed(1)} m/s</text>
        <text x="350" y="20" fontSize="12" textAnchor="end">t = {t.toFixed(1)} s</text>
      </svg>
    )
  }

  const end = stateAt(sc, 4), k = 70 / Math.max(Math.abs(end.x1), Math.abs(end.x2), 1)
  const la = t <= PAIR_T ? Math.min(sc.force * 4, 60) : 0
  const wa = 22 + sc.m1 * 2.2, wb = 22 + sc.m2 * 2.2
  return (
    <svg viewBox="0 0 360 170" style={svg} role="img" aria-label="Two skaters pushing apart">
      <line x1="0" y1="130" x2="360" y2="130" stroke="#57606a" />
      <rect x={170 + s.x1 * k - wa} y={130 - wa * 1.4} width={wa} height={wa * 1.4} fill="#0969da" />
      <rect x={190 + s.x2 * k} y={130 - wb * 1.4} width={wb} height={wb * 1.4} fill="#9a6700" />
      <text x={170 + s.x1 * k - wa / 2} y={125} fill="#fff" fontSize="11" textAnchor="middle">A {sc.m1}kg</text>
      <text x={190 + s.x2 * k + wb / 2} y={125} fill="#fff" fontSize="11" textAnchor="middle">B {sc.m2}kg</text>
      {la > 0 && <Arrow x={170 + s.x1 * k - wa} y={60} len={-la} color="#1a7f37" label={`${sc.force} N on A`} />}
      {la > 0 && <Arrow x={190 + s.x2 * k + wb} y={80} len={la} color="#cf222e" label={`${sc.force} N on B`} />}
      <text x="10" y="20" fontSize="13">A: {Math.abs(s.v1).toFixed(1)} m/s</text>
      <text x="10" y="38" fontSize="13">B: {s.v2.toFixed(1)} m/s</text>
      <text x="350" y="20" fontSize="12" textAnchor="end">t = {t.toFixed(1)} s</text>
    </svg>
  )
}
