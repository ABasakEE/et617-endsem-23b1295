import { useEffect, useRef, useState } from 'react'
import { TAGS, PACKAGE } from './bank.js'
import MotionCanvas from './MotionCanvas.jsx'
import * as E from './engine.js'
import * as api from './api.js'

const ID = '23B1295'
const SAVE = 'nt_v1'
const demo = new URLSearchParams(location.search).get('demo') // harder | alt | prereq
const LAW_TITLE = { 1: 'Law 1: Inertia', 2: 'Law 2: F = ma', 3: 'Law 3: Action and reaction' }
const CHIP = { HARDER: ['Harder task', '#8250df'], ALT: ['Different explanation', '#0969da'], PREREQ: ['Prerequisite lesson', '#9a6700'], NEXT: ['Next task', '#57606a'] }

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

const card = { border: '1px solid #d0d7de', borderRadius: 8, padding: 12, margin: '12px 0' }
const btn = { padding: '10px 16px', fontSize: 16, borderRadius: 6, border: '1px solid #1f2328', background: '#fff', cursor: 'pointer', margin: '4px 4px 4px 0' }
const primary = { ...btn, background: '#1f2328', color: '#fff' }

export default function App() {
  const [view, setView] = useState('home')
  const [st, setSt] = useState(null)
  const [item, setItem] = useState(null)
  const [att, setAtt] = useState(0)
  const [ans, setAns] = useState('')
  const [reason, setReason] = useState('')
  const [hint, setHint] = useState('')
  const [result, setResult] = useState(null)
  const [run, setRun] = useState(0)
  const [busy, setBusy] = useState(false)
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
    const n = s.aCount
    try {
      const r = await api.generate({ tag: step.tag, format: step.format, kind: E.TAG_KIND[step.tag], recent: s.results.slice(-6).map((x) => ({ tag: x.tag, correct: x.correct })) })
      if (typeof r.stem !== 'string' || !r.params) throw new Error('bad shape')
      return E.buildItem(step.tag, step.format, r.params, clean(r.stem), 'ai', n)
    } catch { setDegraded(true); return E.templateItem(step.tag, step.format, n) }
  }

  async function go(s) {
    const p = pre.current; pre.current = null
    const step = p ? p.step : E.nextStep(s)
    if (step.kind === 'done') { setSt(s); return setView('done') }
    if (step.kind === 'recap') { setSt(E.consume(s, step)); return setView('recap') }
    setView('loading')
    const it = step.kind === 'A' ? await (p ? p.promise : genItem(step, s)) : { ...step.item, phase: 'B' }
    setSt(E.consume(s, step)); setItem(it); setAtt(0); setAns(''); setReason(''); setHint(''); setResult(null); setView('item')
  }

  const start = (law) => go(E.newState(law, demo))
  const resume = () => { setSt(saved.st); if (saved.item) { setItem(saved.item); setAtt(0); setAns(''); setReason(''); setHint(''); setView('item') } else go(saved.st) }

  async function submit() {
    setBusy(true)
    let correct = false, tag = item.tag || item.tags?.[0] || null, fb = ''
    const opt = item.options?.find((o) => o.id === ans)
    if (item.format === 'choice') { correct = ans === item.answer; if (!correct && opt?.tag) tag = opt.tag }
    else if (item.format === 'numeric') correct = Math.abs(parseFloat(ans) - item.answer) <= item.tolerance
    else {
      const text = item.format === 'choice+reason' ? reason : ans
      let g
      try {
        g = await api.grade({ prompt: `${item.facts || ''} ${q(item)}`.trim(), learnerText: text, rubric: item.rubric, tags: E.LAW_TAGS[st.law] })
        if (typeof g.correct !== 'boolean') throw new Error('bad shape')
      } catch { setDegraded(true); g = E.gradeLocal(text, item.rubric, tag) }
      correct = (item.format === 'choice+reason' ? ans === item.answer : true) && g.correct
      if (!correct) tag = g.tag || opt?.tag || tag
      fb = g.feedback || ''
    }
    setBusy(false)
    if (!correct && item.phase === 'A' && att === 0) { // retry with a hint that never reveals the answer
      setAtt(1); setAns(''); hintFor.current = item.id
      const canned = E.HINTS[tag]?.[0] || 'Look again at the forces acting on the object.'
      setHint(fb || canned)
      const said = item.format === 'choice' ? opt?.text : item.format === 'numeric' ? `${ans} ${item.unit}` : ans
      api.feedback({ stem: `${item.facts || ''} ${item.story || ''} ${q(item)}`.trim(), learnerAnswer: String(said || ''), tag, attempt: 1 })
        .then((r) => { if (hintFor.current === item.id && typeof r.feedback === 'string') setHint(r.feedback) }).catch(() => setDegraded(true))
      return
    }
    const { state, outcome } = E.decide(st, item, { correct, firstTry: att === 0, tag })
    setSt(state)
    const step = E.nextStep(state)
    pre.current = step.kind === 'A' ? { step, promise: genItem(step, state) } : null // start generating now: hides latency
    setResult({ correct, outcome, feedback: fb }); setRun((r) => r + 1); setView('result')
  }

  const wrap = (children) => (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto', padding: 16, lineHeight: 1.45 }}>
      {children}
      <footer style={{ marginTop: 32, padding: '12px 0', borderTop: '1px solid #d0d7de', fontSize: 13 }}>
        ID {ID} · ET617 End-sem · <button style={{ ...btn, padding: '2px 8px', fontSize: 13 }} onClick={() => { if (view === 'about') setView(prev.current); else { prev.current = view === 'loading' ? 'home' : view; setView('about') } }}>About</button>
      </footer>
    </main>
  )

  if (view === 'about') return wrap(<section><h1>About</h1>
    <p><b>Newton's Traps</b> is an adaptive tutor for Newton's three laws (Class 9). It finds which wrong ideas you hold and fixes the biggest ones in one 10-minute sitting.</p>
    <p>Identity token: <b>{ID}</b><br />Card: P4 adaptive tutor · Newton's laws · L5 repeating learner · C4 10-minute sessions</p>
    <p>Question types: predict-then-watch, numeric, explanation, choice with reason. AI writes scenarios and feedback; the simulator decides what is correct.</p>
    <button style={primary} onClick={() => setView(prev.current)}>Back</button></section>)

  if (view === 'home') return wrap(<section>
    <h1>Newton's Traps</h1>
    <p>Ten minutes. One law. We find the traps that catch you in exams and fix them.</p>
    {demo && <p style={{ ...card, background: '#fff8c5' }}>Demo mode <b>{demo}</b>: {demo === 'harder' ? 'answer the first question correctly to see the HARDER outcome.' : demo === 'alt' ? 'answer wrongly once, then again, to see the DIFFERENT EXPLANATION outcome.' : 'miss a question twice to see the PREREQUISITE outcome.'}</p>}
    {saved?.st && saved.st.elapsed < E.END_AT && <div style={card}>Saved session: {LAW_TITLE[saved.st.law]} ({fmt(saved.st.elapsed)} used). <button style={primary} onClick={resume}>Resume</button></div>}
    {[1, 2, 3].map((l) => <div key={l}><button style={{ ...btn, width: '100%', textAlign: 'left' }} onClick={() => start(l)}>{LAW_TITLE[l]}</button></div>)}</section>)

  if (view === 'loading') return wrap(<p>Getting your next question…</p>)

  const bar = st && (
    <div style={{ margin: '8px 0' }}>
      <div style={{ background: '#eaeef2', height: 8, borderRadius: 4 }}><div style={{ width: `${Math.min(100, (st.elapsed / E.END_AT) * 100)}%`, background: '#0969da', height: 8, borderRadius: 4 }} /></div>
      <small>{fmt(st.elapsed)} of 10:00 · {LAW_TITLE[st.law]} · progress saves automatically{degraded && ' · offline mode: built-in questions/hints'}</small>
      {st.elapsed >= E.RECAP_AT && st.elapsed < E.END_AT && <small> · almost time: a quick recap comes next</small>}
    </div>)
  const stop = <button style={btn} onClick={() => { store({ st, item: view === 'item' ? item : null }); setView('home') }}>Stop for today</button>

  if (view === 'recap') {
    const tag = E.weakestTag(st)
    return wrap(<section>{bar}<h2>Quick recap</h2>
      <p>The idea to remember: <b>{TAGS[tag].label}</b></p><p>{E.ALT_EXPLAIN[tag]}</p>
      <MotionCanvas scenario={E.scenarioForTag(tag)} runKey={run} />
      <button style={primary} onClick={() => go(st)}>Finish</button></section>)
  }

  if (view === 'done') {
    const open = E.LAW_TAGS[st.law].filter((t) => st.gate[t] < E.MASTERY || st.strikes[t] > 0)
    return wrap(<section><h2>Session complete: {LAW_TITLE[st.law]}</h2>
      <p>Time used: {fmt(Math.min(st.elapsed, E.END_AT))}. Questions answered: {st.results.length}.</p>
      {E.LAW_TAGS[st.law].map((t) => <div key={t} style={card}><b>{TAGS[t].label}</b><br />{st.gate[t] >= E.MASTERY && st.strikes[t] === 0 ? 'Looks solid.' : st.gate[t] >= E.MASTERY ? 'Fixed after a slip. Check again tomorrow.' : 'Still open. Start again tomorrow to close it.'}</div>)}
      {open.length === 0 && <p>No open traps. Try another law.</p>}
      <button style={primary} onClick={() => { store(null); setSt(null); setItem(null); setView('home') }}>Choose another law</button></section>)
  }

  if (view === 'result' && result) {
    const [lab, col] = CHIP[result.outcome.type]
    const tag = result.outcome.tag
    const scen = item.phase === 'A' ? item.params : tag ? E.scenarioForTag(tag) : null
    return wrap(<section>{bar}
      <h2>{result.correct ? 'Correct.' : 'Not quite. Here is what happens.'}</h2>
      {result.feedback && <p>{result.feedback}</p>}
      {(item.phase === 'A' || !result.correct) && <><p><b>Answer:</b> {reveal(item)}</p>{scen && <MotionCanvas scenario={scen} runKey={run} />}</>}
      {!result.correct && tag && <div style={card}><b>Another way to see it</b><p>{E.ALT_EXPLAIN[tag]}</p></div>}
      {result.outcome.type === 'PREREQ' && E.prereqFor(tag) && <div style={{ ...card, background: '#fff8c5' }}><b>Prerequisite: {E.prereqFor(tag).title}</b><p>{E.prereqFor(tag).text}</p></div>}
      <p style={{ ...card, borderColor: col }}><b style={{ color: col }}>Tutor decision: {lab}.</b> {result.outcome.reason}</p>
      <button style={primary} onClick={() => go(st)}>Next</button>{stop}</section>)
  }

  // item view
  const isA = item.phase === 'A'
  const choices = item.options && (
    <div>{item.options.map((o) => (
      <label key={o.id} style={{ display: 'block', padding: '10px 8px', border: '1px solid #d0d7de', borderRadius: 6, margin: '6px 0' }}>
        <input type="radio" name="o" checked={ans === o.id} onChange={() => setAns(o.id)} /> {o.text}</label>))}</div>)
  const ready = item.format === 'choice' ? !!ans : item.format === 'choice+reason' ? ans && reason.trim().length > 2 : ans.trim().length > 0
  return wrap(<section>{bar}
    <small>{isA ? 'Concept practice: predict first, then watch' : `Exam check: ${item.kind === 'tricky' ? 'exam-favourite tricky question' : 'standard question'}`}</small>
    {isA && <p><b>{item.facts}</b> {item.story}</p>}
    <p style={{ fontSize: 18 }}>{q(item)}</p>
    {hint && <p style={{ ...card, background: '#ddf4ff' }}>Hint: {hint} Try again.</p>}
    {(item.format === 'choice' || item.format === 'choice+reason') && choices}
    {item.format === 'numeric' && <input value={ans} onChange={(e) => setAns(e.target.value)} inputMode="decimal" placeholder={`answer in ${item.unit}`} style={{ fontSize: 18, padding: 8 }} />}
    {item.format === 'explain' && <textarea value={ans} onChange={(e) => setAns(e.target.value)} rows={3} style={{ width: '100%', fontSize: 16 }} placeholder="Write your reasoning…" />}
    {item.format === 'choice+reason' && <><p>{item.reasonPrompt}</p><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ width: '100%', fontSize: 16 }} /></>}
    <div><button style={primary} disabled={!ready || busy} onClick={submit}>{busy ? 'Checking…' : 'Submit'}</button>{stop}</div>
    {isA && <small>{item.source === 'ai' ? 'AI-written scenario' : 'Built-in scenario'}</small>}
  </section>)
}
