# WORKING.md — live log (newest at bottom of each section)

Clock note: ~45 min left at the start of the build block. Priority = generated questions + animations.

## Done
- Repo `et617-endsem-23b1295` created (private), `DESIGN.md` approved and pushed.
- Vite + React scaffold; footer + About show `23B1295`. Why: identity rule.
- `src/bank.js`: 15 fixed Phase B items + 4 prereq lessons (subagent-drafted, physics re-read by me, `npm test` passes).
- `api/_gemini.js`: shared Gemini call with `thinkingLevel: minimal`. Why: measured 8 s → ~1 s typical; free tier still varies 1–10 s.
- Gemini key works. `gemini-3.8-flash` timed out/503, so `GEMINI_MODEL=gemini-3.5-flash-lite` (in `.env.local` only). `gemini-2.5-flash-lite` 404s for this key.
- DESIGN.md updated: Phase A now generates in 3 formats; format adapts via the next-task rule; latency strategy.

- `src/sim.js`: simulator = answer key (push / fall / pair). Why: the LLM must never decide the physics.
- `src/engine.js`: decision rule (HARDER / ALT / PREREQ / NEXT), mastery gate (2 first-try correct in a row per tag), next-task nature rule (correct choice → explain; streak≥2 → numeric), template generator, `normalizeParams` (repairs bad AI params), keyword grader fallback, time rule (8 min recap, 10 min end). `npm test` covers it (22 asserts-ish, passes).
- `src/MotionCanvas.jsx`: one SVG animation component for all three scenario kinds.
- `src/App.jsx`: session flow, C4 timer bar + Stop/Resume (localStorage), decision chip on every result, demo mode `?demo=harder|alt|prereq`, `?offline=1` forces fallbacks.
- Latency fix: the next Phase A item is requested the moment an answer is submitted, so it generates while the learner watches the animation.
- `/api/health` returns whether env vars are set (no values).

- `/api/generate`, `/api/feedback`, `/api/grade` written by subagent; `scripts/test-api.mjs` ALL PASS locally against real Gemini (latency 6-9 s per call). Server timeout raised to 14 s (`AI_TIMEOUT_MS` overrides), client 16 s, `vercel.json` maxDuration 30. Why: at 8 s about 1 in 3 calls timed out.
- Pushed (commit d03ed40). Live at https://et617-23b1295.vercel.app (alias added as a project domain; the first alias was deployment-only and sat behind Vercel Authentication, now fixed).
- Env vars were set but `hasKey` stayed false: Vercel applies env vars only to NEW deployments. A push triggered a redeploy; live `/api/health` now `hasKey:true, model gemini-3.5-flash-lite`.
- Live endpoint test passed: generate / feedback / grade all 200, ~9 s each (free-tier latency). Generate is hidden behind the animation; grading makes the learner wait ~9 s (falls back to the keyword grader past 16 s).

## Doing now
- Browser click-through of the full session (user + me), mobile width check.

## Next
- Live test: generate/feedback/grade through the deployed site, full session click-through in browser, mobile-width sanity.
- Check Vercel Deployment Protection is OFF for production (evaluator must reach the site without login).
- Phase B items are single-attempt (no retry loop); Phase A has hint + one retry. Known simplification.

## Notes
- Never send persona name / user identity / roll number to Gemini (prompts hold only physics text, tag, learner answer).
- Hint calls never receive the correct answer.

## Keys: what you must do (Vercel)
1. Vercel dashboard → project → Settings → Environment Variables.
2. Add `GEMINI_API_KEY` = your key (tick Production, Preview, Development; mark Sensitive).
3. Add `GEMINI_MODEL` = `gemini-3.5-flash-lite`.
4. Deployments → latest → ⋯ → Redeploy (env vars only apply to new deployments).
5. Open `https://<your-domain>/api/health` — it must show `{"hasKey":true,"model":"gemini-3.5-flash-lite"}`.
6. Local only: `.env.local` already holds both (git-ignored). Never paste the key in chat or commit it.

## UI restyle (soft light theme)
- `src/styles.css`: design tokens (warm off-white, muted teal accent, amber for hints/prereq, no red), CSS-only animations (screen rise, floating orb, staggered law cards, eased progress bar, option select, result pop, decision chip fade, loading dots, meters grow), `prefers-reduced-motion` respected. `App.jsx` now uses class names (logic untouched).
- `MotionCanvas.jsx` rewritten: stroboscopic ghost marks (equal gaps = constant speed, growing gaps = acceleration), live velocity arrow, force/friction/weight arrows, skater figures, Replay + Slow motion buttons, per-kind caption, reduced-motion shows the end state.
- Verified with headless Chrome at 390 px and 1000 px: home, item, hint, result (3 laws), Phase B tricky, done, recap, resume. No console errors. Screenshots were taken offline mode (`?offline=1`).
- Not verified: real AI-generated items in the browser (live site), touch gestures on a real phone.

## Live test findings and fixes
- Live browser test (real AI): hint instant, AI hint swapped in, next AI item ready in ~0.9 s (prefetch works), no console errors.
- FOUND: AI hint stated the answer ("gravity pulls all objects with the same acceleration"). FIX: `/api/feedback` prompt now asks for one question only and the server keeps just the question sentence (502 → canned hint if none). `/api/grade` keeps only the question sentence on a miss.
- FOUND: AI story named different objects than the facts line. FIX: story no longer displayed; the facts line (built from validated params) is the only scenario text. AI still chooses the scenario numbers, hints, grading.
- Remaining softness: guiding questions can still lean toward the answer; no way to guarantee otherwise with an LLM.
