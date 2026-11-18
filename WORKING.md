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
- Live `/api/health` currently `hasKey:false` → env vars NOT set on Vercel yet, so live AI calls fall back.

## Doing now
- Waiting on user: set Vercel env vars + redeploy (steps below). Then test live end to end.

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
