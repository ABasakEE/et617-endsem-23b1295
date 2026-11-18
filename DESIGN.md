# DESIGN.md — Newton's Traps (ET617 end-sem, ID 23B1295)

**Card:** P4 Adaptive tutor · T6 Newton's laws (Cl. 9) · L5 Repeating learner · C4 10-minute sessions

## 1. Problem
Learners who have already failed a topic usually know the definitions but still fall for the classic wrong ideas
("a moving object needs a force to keep moving"). Routine practice does not expose those ideas, and
the learner has little time before the exam. We build a tutor that finds *which* wrong ideas the learner holds
and fixes the top ones inside one 10-minute sitting per law.

## 2. Learning outcomes (per law, Class 9, 1-D motion only)
- **Law 1:** predict the motion of an object under zero net force, and explain why no force is needed to keep it moving.
- **Law 2:** use F = ma to compare accelerations for different masses and forces, including free fall.
- **Law 3:** state that action and reaction act on *different* bodies, are equal in size, and do not cancel.
- **All:** recognise and avoid the two commonest exam traps for each law.

## 3. Persona (expanded from L5)
**Abhishek Tripathi, 14, Class 9.** Windows home laptop, studies in the evening after school. Today in class he could not answer
basic questions; exam is at the end of the week. He has about 10 minutes a day for this topic, English medium.
- *Prior knowledge:* can recite the three laws and F = ma; applies the formula by rote. [confirm]
- *Likely misconceptions:* force is needed to keep motion going; heavier things fall faster; action and reaction cancel. 
- *Affect:* anxious and low self-efficacy after failing; reacts badly to red marks and countdowns.
- *Motivation:* not to be caught out again at the end-of-week exam.

## 4. Session design (one law = one session = one 10-minute sequence)
Two phases:
- **Phase A — Concept loop (dynamic).** An AI generator makes predict-then-watch animation questions from the learner's weak tags and previous answers. The learner retries with hints (max 3 attempts per item, then the animation is shown and a fresh variant follows) until the **mastery gate**: 2 correct in a row on the targeted tag. Starts with 3 items; more are generated while the gate is unmet and time remains.
- **Phase B — Standard package (fixed, identical for all).** 3 standard + 2 exam-favourite "tricky" items per law (15 in total). Gives a comparable, exam-like checkpoint. A missed tricky item returns the learner to Phase A for that tag.
Phase B is also where explanation grading happens for free-text items.

**Formats (≥3 required) — Phase A generates in three of them:** (1) predict-then-watch choice, (2) numeric answer (e.g. speed after 4 s), (3) free-text explanation graded against a rubric. Phase B (fixed) uses numeric, explanation and choice + one-line reason.

**Generation rule (keeps physics correct):** the LLM only chooses scenario parameters within validated ranges for a target tag and format and writes the scenario wording. Scenario kinds: `push {mass, force, friction, v0}`, `fall {m1, m2}`, `pair {m1, m2, force}`. The correct outcome and numeric answer are computed by the simulator (`src/sim.js`), never by the LLM. Parameters are clamped client-side. If generation fails, a deterministic template generator picks the parameters.

**Next-task nature rule (format adapts, not only difficulty):**
- Correct first-try *choice* on a tag with no explanation yet → next item is an **explain** item (guard against guessing).
- `streak ≥ 2` (HARDER) → next item is **numeric**.
- Wrong choice → hint, retry; failed item → animation reveal, then a fresh **choice** item on the same tag (ALT) or after the prerequisite lesson (PREREQ).

**Hint ladder (never reveals the gold answer):** nudge → pointed question → show the animation. For hints the server sends the LLM the question, the wrong answer and the tag but **not** the correct answer. For explanation grading the rubric is sent, and the output is post-filtered for leaks.

## 5. Misconception bank (the core content — each tag drives diagnosis)
| Tag | Law | Wrong idea | Correct idea |
|---|---|---|---|
| M1a | 1 | Moving object needs a force to keep moving; on frictionless ice it slowly stops | No net force → constant velocity forever |
| M1b | 1 | Balanced forces (net force 0) means the object is at rest | Balanced forces → rest *or* constant velocity |
| M2a | 2 | Heavier objects fall faster / accelerate more in free fall | Bigger weight force is cancelled by bigger mass; same *g* |
| M2b | 2 | A constant force gives constant speed | Constant force → constant acceleration (speed keeps rising) |
| M3a | 3 | Action and reaction cancel, so nothing moves | They act on different bodies; each body still accelerates |
| M3b | 3 | In a collision the heavier body pushes harder | Forces are equal; the lighter body accelerates more |

Prerequisite micro-lessons (shown when a tag is missed twice): *what is a force*, *net force*, *mass vs weight*, *which body does the force act on*.

**Animations (3 per law, all presets of ONE component `MotionCanvas`):**
- Law 1: frictionless glide · add friction → slows · balanced pull → constant speed.
- Law 2: same force on mass 1 vs 2 · constant force, speed grows · heavy vs light free fall.
- Law 3: two skaters push apart (equal mass) · unequal mass · truck–car collision with equal force arrows.
`MotionCanvas` props `{mass, force, friction, bodies}`; integrates `v += (F − f)/m · dt`. Built last; the app must work text-only first.

## 6. Decision rule (the P4 design challenge)
State per law: `strikes[tag]`, `streak` (consecutive first-try correct), `elapsed`.
After every answer, exactly one outcome:
1. **HARDER** — correct on first try and `streak ≥ 2`: next item from the harder tier (multi-step or numeric variant).
2. **ALTERNATIVE EXPLANATION** — wrong and the answer maps to tag `m` with `strikes[m] == 1`: show the matching animation + a different explanation, then a **variant re-test** of the same trap.
3. **PREREQUISITE** — wrong with the same tag and `strikes[m] ≥ 2`: show the prerequisite micro-lesson, then re-test.

Rules for this learner (L5): never raise difficulty immediately after a miss; wrong answers use neutral wording (no red, no score deduction).
**Time rule:** if `elapsed ≥ 8 min`, skip new items and run a recap of the tag with the most strikes, then end the session.
**Demo mode** (`?demo=harder|alt|prereq`) forces each branch so the evaluator can see all three outcomes.

## 7. Design constraint C4 — how it is visibly met
- Soft **10-minute bar** for the session (no per-question countdown).
- Fixed short arc (≈8 items, ~75 s each).
- **Stop for today** button; state saved to `localStorage` after every answer (law, item index, strikes, streak, elapsed).
- On return a **Resume** banner restores exactly where the learner left off.
- At 10:00 the learner finishes the current item, then gets a wrap-up listing which traps are still open.

## 8. AI use and failure handling
- **Fixed, hand-reviewed:** the Phase B standard package (15 items), the tag table and the prerequisite micro-lessons.
- **AI at runtime** (Gemini free tier via `/api/*` serverless functions; key only in the Vercel env var `GEMINI_API_KEY`, model in `GEMINI_MODEL`):
  1. `/api/generate`: picks the target tag and scenario parameters for the next Phase A item and writes the wording. Output is JSON validated against ranges and the allowed tag list.
  2. `/api/feedback`: writes a hint or explanation for a wrong answer, **without** being given the correct answer.
  3. `/api/grade`: grades free-text explanations against a rubric and returns `{correct, tag|null, feedback}`. A tag outside the allowed list is discarded.
- Learner text is delimited as data in every prompt.
- **Latency (measured 1–10 s on free tier, model `gemini-3.5-flash-lite`, `thinkingLevel: minimal`):** the next Phase A item is requested the moment the learner submits an answer, so it generates while they watch the animation and read feedback. Timeouts: generate 12 s, feedback 8 s, grade 10 s. Canned per-tag hints are shown instantly; AI hints replace them if they arrive in time.
- **If any call fails, times out, or is rate-limited:** template generator, canned hints and a keyword rubric take over, and a small "offline mode" badge appears. Choice/numeric items never need AI to be graded.

## 9. Architecture
Vite + React (JSX). `src/bank.js` (Phase B package, tags, micro-lessons), `src/engine.js` (pure decision rule + mastery gate + template generator, assert-based tests), `src/MotionCanvas.jsx` (simulator = source of truth for outcomes),
`src/App.jsx` (session flow + persistence), `api/generate.js`, `api/feedback.js`, `api/grade.js` (Vercel functions, one shared Gemini helper). No database, no login, no teacher view.

## 10. Learner scenarios
**A — recovers (Law 1):** Abhishek answers the frictionless-ice trap with "it slows down" (M1a). The tutor shows the glide animation, explains with a different example, then asks a variant. He answers it correctly; the next item is harder.
**B — struggles and resumes (Law 2):** He picks "heavier falls faster" twice (M2a, strikes = 2). The tutor gives the "same force pair vs mass" prerequisite, then re-tests. At 10:00 the bar fills; he finishes the current item, sees the open trap and taps *Stop for today*. Next evening a Resume banner takes him straight back.

## 11. Build order (clock started 18:43)
1. 18:43–18:55 scaffold + push + **deploy skeleton to Vercel**
2. –19:20 `bank.js` (15 items) + `engine.js` (rule, gate, template generator) + asserts; `MotionCanvas` simulator core early because it is the answer key
3. –19:45 session UI, formats, C4 save/resume
4. –20:00 `/api/grade` + fallback
5. –20:15 `MotionCanvas` presets
6. –20:25 demo mode, final deploy test, viva notes
Cut line if behind: drop Law 3 animations first, then prerequisite micro-lessons to text only.

## 12. Identity, deployment and privacy rules
- **Identity token `23B1295`** appears in the footer of every screen and on an About screen (card: P4 · Newton's laws · L5 · C4).
- **Deploy** at `et617-23b1295.vercel.app` (or the nearest Vercel alias). **Repo:** `et617-endsem-23b1295`.
- **Secrets:** `GEMINI_API_KEY` and `GEMINI_MODEL` live only in `.env.local` (git-ignored) for local tests and in Vercel env vars for the live app. Never in client code, the repo or chat.
- **No personal data leaves the app:** prompts to Gemini contain only question text, scenario parameters, the learner's answer and the tag. They never contain the persona's name, the user's identity, email or roll number. The persona name is only shown in the UI/report.

## 13. Out of scope
Teacher view, voice, regional languages, accounts, runtime generation of the Phase B package.
