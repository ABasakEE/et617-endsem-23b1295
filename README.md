# Newton's Traps - adaptive tutor for Newton's laws (ET617 end-sem)

Newton's Traps is a small web app for a Class 9 learner who has already failed the Newton's-laws unit. It finds *which* wrong ideas the learner holds (for example "a moving object needs a force to keep moving") and fixes the top ones in one 10-minute sitting per law. An AI model writes the scenario numbers, hints and grading of explanations. A built-in physics simulator decides what is actually correct, so the AI never decides the physics.

- Live app: https://et617-23b1295.vercel.app
- Identity token: **23B1295** (shown in the footer of every screen and on the About screen)
- Repo name: `et617-endsem-23b1295`
- Design notes: `DESIGN.md` (plan) and `WORKING.md` (build log and test findings)

## 1. Exam card and how each part is visible

| Card item | Value | Where you see it in the app |
|---|---|---|
| Problem | P4 adaptive tutor with automatic question generation | Concept practice items are generated per learner (weak tag, format); each result shows a "Tutor decision" line |
| Topic | T6 Newton's laws (Class 9) | Home screen: three law cards (inertia, F = ma, action and reaction), six misconception tags |
| Learner | L5 repeating learner, anxious (persona Abhishek Tripathi, 14; the name is not used in the app or sent to the AI) | Calm wording, no red marks, no per-question countdown, hint plus one retry before any "miss", wrong answers followed by an animation |
| Constraint | C4 10-minute sessions with stop/resume | Soft 10-minute bar, "Stop for today" button, automatic save, "Resume" card on the home screen, recap at 8:00 |

## 2. How a session works

One law = one session. The learner picks a law and goes through two phases.

- **Phase A (AI-generated, adaptive concept loop).** Each item is a short scenario (push, free fall or two skaters) for a weak misconception tag. The learner predicts first, then watches the animation. Items repeat until the **mastery gate** is met (2 first-try correct answers in a row on each tag of the law) or 6 Phase A items have been used.
- **Phase B (fixed standard package, same for everyone).** 5 hand-reviewed items per law: 3 standard + 2 tricky (exam-favourite traps). A missed tricky item sends the learner back to Phase A for that tag.

Before Phase A, every learner reads a 30-second concept card for the law.

### Question types

| Type | What the learner does | Phase | Graded by |
|---|---|---|---|
| **Predict-then-watch choice** | Reads a scenario, picks what will happen, then watches the animation play before the verdict appears | A (generated), B (fixed choice items) | Code, using the simulator as answer key |
| **Numeric** | Types a number (distance, speed or acceleration, tolerance 0.15) | A (generated), B (fixed) | Code |
| **Explain** | Writes 1-2 sentences on what happens and why | A (generated), B (fixed) | AI against a rubric; keyword grader if the AI is down |
| **Choice + reason** ("tricky") | Picks an option and gives a one-line reason; built around a classic exam trap | B only | Choice by code, reason by AI (keyword fallback) |

### Order of serving

1. **Concept card** for the chosen law.
2. **Phase A, adaptive.** The first item is a predict-then-watch choice on a weak idea. What follows depends on the answers:
   - correct on the first try, no explanation yet on that idea: **explain** item on the same idea (guessing guard);
   - two first-try correct answers in a row: a **numeric** item (harder) on the next open idea;
   - a miss: hint and one retry, then the animation, a different explanation (or the prerequisite lesson on the second miss) and a fresh **choice** on the same idea; from the third miss the next task is an **explain** item instead of repeating the lesson.

   Typical path for a strong learner: choice, explain, numeric, choice. Phase A ends when both ideas of the law reach the mastery gate, after 6 items, or at 8:00.
3. **Phase B, fixed package.** Always in this order: standard numeric, standard choice, standard explain, tricky choice + reason, tricky choice + reason. Phase B items are single-attempt. A missed tricky item sends the learner back for one Phase A item on that idea, then Phase B continues.
4. **Recap** of the weakest idea at 8:00 and a summary of open and closed traps at the end.

| Law | S1 numeric | S2 choice | S3 explain | T1 tricky (idea) | T2 tricky (idea) |
|---|---|---|---|---|---|
| 1 Inertia | puck on frictionless ice, distance in 4 s | bus passenger tilts back | book stops on a rough table | frictionless puck (needs a force to keep moving) | steady box, 30 N pull = 30 N friction (balanced means rest) |
| 2 F = ma | 20 N on a 4 kg trolley | same force on 2 kg and 4 kg carts | empty vs full shopping cart | 5 kg and 1 kg ball dropped (heavier falls faster) | constant 10 N on a cart (constant force means constant speed) |
| 3 Action-reaction | skater pushes with 60 N, acceleration | foot kicks a football | gun kicks back when fired | horse and cart (forces cancel) | truck hits car (heavier pushes harder) |

## 3. The decision rule (the P4 design challenge)

After every finished item the function `decide()` in `src/engine.js` returns exactly one outcome. State kept per law: `strikes[tag]`, `streak` (consecutive first-try correct), `gate[tag]`, `elapsed`.

| Outcome | Trigger | What the learner sees next |
|---|---|---|
| HARDER | Correct on the first try and `streak >= 2` (streak then resets) | Next task is a numeric (harder) item |
| ALTERNATIVE EXPLANATION | Final answer wrong and `strikes[tag] == 1` (first miss on that tag) | Animation, a different analogy ("Another way to see it"), then a fresh choice question on the same tag |
| PREREQUISITE | Final answer wrong and `strikes[tag] == 2` | Animation, the prerequisite micro-lesson for that tag, then a fresh choice question |
| ALTERNATIVE EXPLANATION (3rd+ miss) | Final answer wrong and `strikes[tag] >= 3` | The same lesson is not repeated; the next task switches to an **explain** item and the learner is told stopping for today is fine |
| NEXT | Everything else | Normal next item; see the format rule below |

Other rules:
- **Format adapts, not only difficulty.** A correct first-try *choice* in Phase A on a tag with no explanation yet makes the next task an **explain** item (guards against guessing). HARDER makes the next task **numeric**. A miss makes the next task a **choice** on the same tag.
- **Mastery gate.** `gate[tag]` counts first-try correct answers in a row (Phase A); a miss or a retry-success resets it to 0. Phase A ends when all tags reach 2 (or 6 items), then Phase B starts.
- **Never raise difficulty right after a miss.** A miss resets the streak; wrong answers use neutral wording.
- **Time rule (C4).** Time counts only while the page is visible. At 8:00 no new items start; a recap of the weakest tag (most strikes) is shown. The item in progress is finished, and at 10:00 the session ends with a summary of open and closed traps.
- **Demo URLs.** `?demo=harder` (first correct first-try answer triggers HARDER), `?demo=prereq` (the first final miss triggers PREREQUISITE), `?demo=alt` (answer wrongly twice, since the first wrong answer only earns a hint, to see ALTERNATIVE EXPLANATION). `?offline=1` forces the no-AI fallbacks. They can be combined, for example `/?demo=prereq&offline=1`.

## 4. Where AI is used and how it is kept safe

Three Vercel serverless endpoints call Gemini through one helper (`api/_gemini.js`, JSON output, minimal thinking).

| Endpoint | What the AI does | Checks on the output |
|---|---|---|
| `POST /api/generate` | Chooses scenario numbers for a tag and format and writes a short stem | Numbers are clamped to fixed ranges and forced to the tag's shape (for example M1a has force 0 and friction 0); unusable output returns 502. Number sets already shown are avoided (asked of the AI and enforced again in the app). The app shows the validated facts line, not the AI story |
| `POST /api/feedback` | Writes one guiding question after a wrong answer | Never receives the correct answer; only the final question sentence is kept; otherwise 502 and a canned hint is shown |
| `POST /api/grade` | Grades an explanation or reason against a rubric (reasoning-first prompt, also given the simulator-computed outcome and the chosen option) and may name the misconception tag | Tag must be in the allowed list; feedback that copies a rubric key point is replaced; on a miss only a guiding question is returned |

There is also `GET /api/health`, which says whether the env vars are set (never their values).

Safety and robustness:
- **Simulator is the answer key.** `src/sim.js` computes outcomes and numeric answers (`g = 10 m/s^2`). The AI only picks numbers inside validated ranges; `normalizeParams` in `src/engine.js` repairs any bad value on the client too.
- **Hints never get the answer** and only the guiding question is shown to the learner.
- **Learner text is delimited as data** (`<learner_text>` tags, closing tags stripped, length capped) and the prompt says to ignore instructions inside it.
- **Fallbacks:** template generator, canned per-tag hints, keyword grader. A small "offline mode" note appears in the session bar when any AI call fails or times out. Choice and numeric items never need AI.
- **No personal data is sent.** Prompts contain only physics text, the tag, recent tags with correct/incorrect, earlier number sets, and the learner's answer. No name, email or roll number.
- **Latency hiding.** The next Phase A item is requested as soon as an answer is submitted, so it is generated while the learner watches the animation.

## 5. Tech and project structure

Vite + React 18 (JSX), plain CSS, Vercel serverless functions, Gemini API. No database, no login.

```
src/
  App.jsx          session flow, timer bar, stop/resume (localStorage), demo and offline switches
  engine.js        decision rule, mastery gate, next-step logic, template generator, keyword grader
  sim.js           physics simulator = answer key (push, fall, pair)
  MotionCanvas.jsx one SVG animation component for all scenarios (replay, slow motion)
  bank.js          Phase B package (15 items), misconception tags, prerequisite lessons
  api.js           client for the AI endpoints (any failure falls back)
  styles.css       soft light theme, no red
api/
  generate.js  feedback.js  grade.js   AI endpoints
  health.js                            env check
  _gemini.js                           shared Gemini call
scripts/
  check-bank.mjs  test-engine.mjs      offline tests (run by npm test)
  test-api.mjs    test-gemini.mjs      real-AI tests (need .env.local)
vercel.json        function maxDuration 30 s
```

## 6. Run locally

```
npm install
npm run dev     # http://localhost:5173
npm test        # bank checks and engine tests, no network needed
npm run build   # production build into dist/
```

`/api/*` routes only exist on Vercel or under `vercel dev`. With plain `npm run dev` the AI calls fail and the app runs in offline mode (template questions, canned hints, keyword grader), which is still fully usable.

AI scripts (need `.env.local` with the two variables below; they send only generic physics prompts):

```
node --env-file=.env.local scripts/test-api.mjs
node --env-file=.env.local scripts/test-gemini.mjs
```

## 7. Deploy and environment variables

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini key (secret) |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` (the model used) |
| `AI_TIMEOUT_MS` | optional; server timeout per AI call, default 14000 |

1. Vercel project, Settings, Environment Variables: add both for Production.
2. Redeploy. Env vars apply only to new deployments, so changing them has no effect until you redeploy.
3. Open `/api/health`; it should show `{"hasKey":true,"model":"gemini-3.5-flash-lite"}`.

Never commit the key. `.env.local` is git-ignored (see `.env.example` for the names only).

## 8. Known limitations

- Free-tier Gemini latency is 1-10 s per call. Generation is hidden behind the animation, but grading an explanation can make the learner wait; after 16 s the keyword grader takes over.
- Phase B items are single-attempt (no hint or retry loop).
- The AI's guiding questions can still lean toward the answer; filters reduce this but cannot guarantee it.
- No teacher view, accounts or voice. Progress is stored only in the browser (`localStorage`).
- Physics is limited to 1-D, Class 9 level, six misconception tags.

## 9. AI-use note

AI assistance (Claude Code) was used to build this app, including code, tests and documentation. The fixed question bank was re-read for physics correctness, and the code is covered by offline tests (`npm test`) and live endpoint tests; the author should still review the content.
