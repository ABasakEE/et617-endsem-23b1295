import { useEffect, useRef, useState } from 'react'
import { TAGS, PACKAGE } from './bank.js'
import MotionCanvas from './MotionCanvas.jsx'
import * as E from './engine.js'
import * as api from './api.js'
import './styles.css'

const ID = '23B1295'
const SAVE = 'nt_v1'
const demo = new URLSearchParams(location.search).get('demo') // harder | alt | prereq
const LAW_TITLE = { 1: 'Law 1: Inertia', 2: 'Law 2: F = ma', 3: 'Law 3: Action and reaction' }
const CHIP = { HARDER: ['Harder task', 'harder'], ALT: ['Different explanation', 'alt'], PREREQ: ['Prerequisite lesson', 'prereq'], NEXT: ['Next task', 'next'] }
const CONCEPT = {
  1: ['An object keeps doing what it is already doing, staying at rest or moving in a straight line at steady speed, unless a net force acts on it. "Net" means all the forces added up.',
    'Balanced forces add up to zero, so they change nothing. Friction is also a force. That is why things slow down on a rough floor but glide on frictionless ice.'],
  2: ['The net force on an object equals its mass times its acceleration: F = ma. The same push gives a lighter object more acceleration.',
    'A constant net force gives a constant acceleration, so the speed keeps changing steadily. In free fall, weight (mass × 10) and mass grow together, so every object accelerates at 10 m/s².'],
  3: ['When one body pushes on another, the second pushes back on the first with an equal force in the opposite direction.',
    'The two forces act on different bodies, so they never cancel each other. Each body still accelerates by a = F/m, so the lighter body moves more.'],
}
const LAW_SUB ={ 1: 'Why things keep moving', 2: 'How force, mass and acceleration connect', 3: 'Pairs of forces between two bodies' }

const load = () => { try { return JSON.parse(localStorage.getItem(SAVE)) } catch { return null } }
const store = (v) => { try { v ? localStorage.setItem(SAVE, JSON.stringify(v)) : localStorage.removeItem(SAVE) } catch { /* private mode: resume just won't work */ } }
const clean = (s) => String(s).replace(/[^.!?]*\?\s*$/, '').trim().slice(0, 300) // drop the model's own question; ours is deterministic
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const q = (it) => it.prompt ?? it.question
const reveal = (it) => {
  if (it.reveal) return it.reveal
  if (it.format === 'numeric') return `${it.answer} ${it.unit}`
  if (it.format === 'explain') return it.rubric.keyPoints.join(' ')
  return it.options.find((o) => o.id === it.answer).text + (it.rubric ? ` ${it.rubric.keyPoints.join(' ')}` : '')
}


// Boxes the words the AI chose to focus on (or a built-in glossary when it chose none).
function Marked({ text, words }) {
  const ws = words?.length ? words : E.autoHighlight(text)
  if (!ws.length) return text
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="hl">{part}</mark> : part))
}

export default function App() {
  const [view, setView] = useState('home')
  const [st, setSt] = useState(null)
  const [item, setItem] = useState(null)
  const [att, setAtt] = useState(0)
  const [ans, setAns] = useState('')
  const [reason, setReason] = useState('')
  const [hint, setHint] = useState('')
  const [hintHl, setHintHl] = useState([])
  const [result, setResult] = useState(null)
  const [run, setRun] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(1)
  const [watched, setWatched] = useState(false) // predict-then-watch: verdict and answer stay hidden until the animation has played
  const [degraded, setDegraded] = useState(false)
  const pre = useRef(null) // prefetched next Phase A item, generated while the learner watches the animation
  const hintFor = useRef(null)
  const prev = useRef('home')
  const saved = load()

  // C4: 10-minute budget, counted only while the page is visible during a session.
  useEffect(() => {
    if (!['item', 'result', 'recap', 'loading'].includes(view)) return
    const id = setInterval(() => { if (document.visibilityState === 'visible') setSt((s) => (s ? { ...s, elapsed: s.elapsed + 1 } : s)) }, 1000)
    return () => clearInterval(id)
  }, [view])
  useEffect(() => { if (st && view !== 'home' && view !== 'about') store(view === 'done' ? null : { st, item: view === 'item' ? item : null }) }, [st, item, view])

  async function genItem(step, s) {
    const n = s.aCount, seen = s.seen || []
    try {
      const r = await api.generate({ tag: step.tag, format: step.format, kind: E.TAG_KIND[step.tag], recent: s.results.slice(-6).map((x) => ({ tag: x.tag, correct: x.correct })), avoid: seen.slice(-6).map(E.sigToParams) })
      if (typeof r.stem !== 'string' || !r.params) throw new Error('bad shape')
      return E.buildItem(step.tag, step.format, E.unseenParams(step.tag, r.params, seen, n), clean(r.stem), 'ai', n)
    } catch { setDegraded(true); return E.templateItem(step.tag, step.format, n, seen) }
  }

  async function go(s) {
    const p = pre.current; pre.current = null
    const step = p ? p.step : E.nextStep(s)
    if (step.kind === 'done') { setSt(s); return setView('done') }
    if (step.kind === 'recap') { setSt(E.consume(s, step)); return setView('recap') }
    setView('loading')
    const it = step.kind === 'A' ? await (p ? p.promise : genItem(step, s)) : { ...step.item, phase: 'B' }
    const c = E.consume(s, step)
    setSt(step.kind === 'A' ? { ...c, seen: [...(c.seen || []), E.sigOf(it.params)] } : c); setItem(it); setAtt(0); setAns(''); setReason(''); setHint(''); setResult(null); setView('item')
  }

  const start = (law) => { setPending(law); setView('concept') } // D3: every learner sees the concept first
  const resume = () => { setSt(saved.st); if (saved.item) { setItem(saved.item); setAtt(0); setAns(''); setReason(''); setHint(''); setView('item') } else go(saved.st) }

  async function submit() {
    setBusy(true)
    let correct = false, tag = item.tag || item.tags?.[0] || null, fb = '', hl = []
    const opt = item.options?.find((o) => o.id === ans)
    if (item.format === 'choice') { correct = ans === item.answer; if (!correct && opt?.tag) tag = opt.tag }
    else if (item.format === 'numeric') correct = Math.abs(parseFloat(ans) - item.answer) <= item.tolerance
    else {
      const text = item.format === 'choice+reason' ? reason : ans
      let g
      try {
        g = await api.grade({ prompt: `${item.facts || ''} ${q(item)}`.trim(), learnerText: text, rubric: item.rubric, tags: E.LAW_TAGS[st.law], reference: item.reference, chosen: opt?.text })
        if (typeof g.correct !== 'boolean') throw new Error('bad shape')
      } catch { setDegraded(true); g = E.gradeLocal(text, item.rubric, tag) }
      correct = (item.format === 'choice+reason' ? ans === item.answer : true) && g.correct
      if (!correct) tag = g.tag || opt?.tag || tag
      fb = g.feedback || ''; hl = Array.isArray(g.highlight) ? g.highlight : []
    }
    setBusy(false)
    if (!correct && item.phase === 'A' && att === 0) { // retry with a hint that never reveals the answer
      setAtt(1); setAns(''); hintFor.current = item.id
      const canned = E.HINTS[tag]?.[0] || 'Look again at the forces acting on the object.'
      setHint(fb || canned); setHintHl(fb ? hl : [])
      const said = item.format === 'choice' ? opt?.text : item.format === 'numeric' ? `${ans} ${item.unit}` : ans
      api.feedback({ stem: `${item.facts || ''} ${item.story || ''} ${q(item)}`.trim(), learnerAnswer: String(said || ''), tag, attempt: 1 })
        .then((r) => { if (hintFor.current === item.id && typeof r.feedback === 'string') { setHint(r.feedback); setHintHl(Array.isArray(r.highlight) ? r.highlight : []) } }).catch(() => setDegraded(true))
      return
    }
    const { state, outcome } = E.decide(st, item, { correct, firstTry: att === 0, tag })
    setSt(state)
    const step = E.nextStep(state)
    pre.current = step.kind === 'A' ? { step, promise: genItem(step, state) } : null // start generating now: hides latency
    const predicted = item.format === 'numeric' ? `${ans} ${item.unit}` : item.format === 'choice' || item.format === 'choice+reason' ? opt?.text : ans
    setWatched(false); setResult({ correct, outcome, feedback: fb, hl, predicted }); setRun((r) => r + 1); setView('result')
  }

  const wrap = (children) => (
    <main className="app">
      <div className="screen" key={`${view}-${item?.id ?? ''}-${run}`}>{children}</div>
      <footer className="foot">
        ID {ID} · ET617 End-sem ·{' '}
        <button className="link" onClick={() => { if (view === 'about') setView(prev.current); else { prev.current = view === 'loading' ? 'home' : view; setView('about') } }}>About</button>
      </footer>
    </main>
  )

  if (view === 'about') return wrap(<section><h1>About</h1>
    <p><b>Newton's Traps</b> is an adaptive tutor for Newton's three laws (Class 9). It finds which wrong ideas you hold and fixes the biggest ones in one 10-minute sitting.</p>
    <p>Identity token: <b>{ID}</b><br />Card: P4 adaptive tutor · Newton's laws · L5 repeating learner · C4 10-minute sessions</p>
    <p>Question types: predict-then-watch, numeric, explanation, choice with reason. AI writes scenarios and feedback; the simulator decides what is correct.</p>
    <button className="btn primary" onClick={() => setView(prev.current)}>Back</button></section>)

  if (view === 'home') return wrap(<section>
    <div className="hero"><div className="orb" aria-hidden="true" /><h1>Newton's Traps</h1>
      <p className="lead">Ten minutes. One law. We find the traps that catch you in exams, then fix them.</p></div>
    {demo && <p className="note amber">Demo mode <b>{demo}</b>: {demo === 'harder' ? 'answer the first question correctly to see the HARDER outcome.' : demo === 'alt' ? 'answer wrongly once, then again, to see the DIFFERENT EXPLANATION outcome.' : 'miss a question twice to see the PREREQUISITE outcome.'}</p>}
    {saved?.st && saved.st.elapsed < E.END_AT && <div className="card resume"><span>Saved: <b>{LAW_TITLE[saved.st.law]}</b> · {fmt(saved.st.elapsed)} used</span><button className="btn primary" onClick={resume}>Resume</button></div>}
    <div className="laws">{[1, 2, 3].map((l) => (
      <button key={l} className="law" style={{ '--d': `${l * 70}ms` }} onClick={() => start(l)}>
        <span className="num">{l}</span><span><b>{LAW_TITLE[l]}</b><small>{LAW_SUB[l]}</small></span><span className="go" aria-hidden="true">→</span>
      </button>))}</div></section>)

  if (view === 'concept') return wrap(<section>
    <span className="tag">Quick concept · 30 seconds</span>
    <h2>{LAW_TITLE[pending]}</h2>
    {CONCEPT[pending].map((t) => <p key={t}>{t}</p>)}
    <p className="note blue">Next you will predict what happens, then watch. A wrong prediction is useful: it shows us the trap to fix.</p>
    <div className="row"><button className="btn primary" onClick={() => go(E.newState(pending, demo))}>Start my 10 minutes</button><button className="btn ghost" onClick={() => setView('home')}>Back</button></div></section>)

  if (view === 'loading') return wrap(<div className="loading" role="status"><i /><i /><i /><span>Getting your next question</span></div>)

  const bar = st && (
    <div className="barwrap">
      <div className="bar" role="progressbar" aria-valuemin="0" aria-valuemax="600" aria-valuenow={Math.min(600, st.elapsed)}><div style={{ width: `${Math.min(100, (st.elapsed / E.END_AT) * 100)}%` }} /></div>
      <small>{fmt(st.elapsed)} of 10:00 · {LAW_TITLE[st.law]} · saves automatically{degraded && ' · offline mode: built-in questions/hints'}{st.elapsed >= E.RECAP_AT && st.elapsed < E.END_AT && ' · almost time: a quick recap comes next'}</small>
    </div>)
  const stop = <button className="btn ghost" onClick={() => { store({ st, item: view === 'item' ? item : null }); setView('home') }}>Stop for today</button>

  if (view === 'recap') {
    const tag = E.weakestTag(st)
    return wrap(<section>{bar}<h2>Quick recap</h2>
      <p>The idea to remember: <b>{TAGS[tag].label}</b></p><p>{E.ALT_EXPLAIN[tag]}</p>
      <MotionCanvas scenario={E.scenarioForTag(tag)} runKey={run} />
      <button className="btn primary" onClick={() => go(st)}>Finish</button></section>)
  }

  if (view === 'done') {
    const open = E.LAW_TAGS[st.law].filter((t) => st.gate[t] < E.MASTERY || st.strikes[t] > 0)
    return wrap(<section><h2>Session complete</h2>
      <p className="lead">{LAW_TITLE[st.law]} · {fmt(Math.min(st.elapsed, E.END_AT))} used · {st.results.length} questions</p>
      {E.LAW_TAGS[st.law].map((t, i) => {
        const closed = st.gate[t] >= E.MASTERY
        return (<div key={t} className="card trap" style={{ '--d': `${i * 120}ms` }}>
          <b>{TAGS[t].label}</b>
          <div className="meter"><div className={closed ? 'full' : ''} style={{ '--w': `${Math.max(8, Math.min(100, (st.gate[t] / E.MASTERY) * 100))}%` }} /></div>
          <small>{closed && st.strikes[t] === 0 ? 'Looks solid.' : closed ? 'Fixed after a slip. Check again tomorrow.' : 'Still open. Start again tomorrow to close it.'}</small></div>)
      })}
      {open.length === 0 && <p>No open traps. Try another law.</p>}
      <button className="btn primary" onClick={() => { store(null); setSt(null); setItem(null); setView('home') }}>Choose another law</button></section>)
  }

  if (view === 'result' && result) {
    const [lab, cls] = CHIP[result.outcome.type]
    const tag = result.outcome.tag
    const scen = item.phase === 'A' ? item.params : tag ? E.scenarioForTag(tag) : null
    const gated = item.phase === 'A' && !watched // Phase A: show prediction, play the animation, only then reveal
    return wrap(<section>{bar}
      <h2 className={`res ${gated ? '' : result.correct ? 'ok' : 'miss'}`}>{gated ? 'Now watch what happens' : result.correct ? '✓ Correct' : 'Not quite. Here is what happened.'}</h2>
      {item.phase === 'A' && result.predicted && <p>You predicted: <b>{result.predicted}</b></p>}
      {scen && (item.phase === 'A' || !result.correct) && <MotionCanvas scenario={scen} runKey={run} onDone={() => setWatched(true)} />}
      {gated && <button className="btn ghost sm" onClick={() => setWatched(true)}>Skip animation</button>}
      {!gated && <div className="screen">
        {result.feedback && <p><Marked text={result.feedback} words={result.hl} /></p>}
        {(item.phase === 'A' || !result.correct) && <p><b>What happened:</b> {reveal(item)}</p>}
        {!result.correct && tag && <div className="card"><b>Another way to see it</b><p>{E.ALT_EXPLAIN[tag]}</p></div>}
        {result.outcome.type === 'PREREQ' && E.prereqFor(tag) && <div className="card amber"><b>Prerequisite: {E.prereqFor(tag).title}</b><p>{E.prereqFor(tag).text}</p></div>}
        <p className={`decision ${cls}`}><b>Tutor decision: {lab}.</b> {result.outcome.reason}</p>
        <div className="row"><button className="btn primary" onClick={() => go(st)}>Next</button>{stop}</div></div>}</section>)
  }

  // item view
  const isA = item.phase === 'A'
  const choices = item.options && (
    <div className="opts">{item.options.map((o) => (
      <label key={o.id} className={`opt${ans === o.id ? ' sel' : ''}`}>
        <input className="sr" type="radio" name="o" checked={ans === o.id} onChange={() => setAns(o.id)} /><span className="dot" aria-hidden="true" />{o.text}</label>))}</div>)
  const ready = item.format === 'choice' ? !!ans : item.format === 'choice+reason' ? ans && reason.trim().length > 2 : ans.trim().length > 0
  return wrap(<section>{bar}
    <span className={`tag ${isA ? '' : item.kind}`}>{isA ? 'Concept practice · predict first, then watch' : `Exam check · ${item.kind === 'tricky' ? 'exam-favourite tricky question' : 'standard question'}`}</span>
    {isA && <p className="facts"><b>{item.facts}</b></p>}
    <p className="qtext">{q(item)}</p>
    {hint && <p className="note blue" key={hint}>Hint: <Marked text={hint} words={hintHl} /> Try again.</p>}
    {(item.format === 'choice' || item.format === 'choice+reason') && choices}
    {item.format === 'numeric' && <input className="field" value={ans} onChange={(e) => setAns(e.target.value)} inputMode="decimal" placeholder={`answer in ${item.unit}`} />}
    {item.format === 'explain' && <textarea className="field" value={ans} onChange={(e) => setAns(e.target.value)} rows={3} placeholder="Write your reasoning…" />}
    {item.format === 'choice+reason' && <><p>{item.reasonPrompt}</p><textarea className="field" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></>}
    <div className="row"><button className="btn primary" disabled={!ready || busy} onClick={submit}>{busy ? 'Checking…' : 'Submit'}</button>{stop}</div>
    {isA && <small className="src">{item.source === 'ai' ? 'Scenario chosen by AI for your weak spot' : 'Built-in scenario'}</small>}
  </section>)
}
