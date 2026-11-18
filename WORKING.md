# WORKING.md — live log (newest at bottom of each section)

Clock note: ~45 min left at the start of the build block. Priority = generated questions + animations.

## Done
- Repo `et617-endsem-23b1295` created (private), `DESIGN.md` approved and pushed.
- Vite + React scaffold; footer + About show `23B1295`. Why: identity rule.
- `src/bank.js`: 15 fixed Phase B items + 4 prereq lessons (subagent-drafted, physics re-read by me, `npm test` passes).
- `api/_gemini.js`: shared Gemini call with `thinkingLevel: minimal`. Why: measured 8 s → ~1 s typical; free tier still varies 1–10 s.
- Gemini key works. `gemini-3.8-flash` timed out/503, so `GEMINI_MODEL=gemini-3.5-flash-lite` (in `.env.local` only). `gemini-2.5-flash-lite` 404s for this key.
- DESIGN.md updated: Phase A now generates in 3 formats; format adapts via the next-task rule; latency strategy.

## Doing now
- Subagent: `/api/generate`, `/api/feedback`, `/api/grade` (+ leak filter, test script).
- Me: `src/sim.js` (answer key), `src/engine.js` (decision rule, generator, local grader), `MotionCanvas.jsx`, `App.jsx`, `/api/health`.

## Next
- Wire client to API with fallbacks; demo mode `?demo=harder|alt|prereq`, `?offline=1`.
- Commit/push; verify Vercel env vars; test live.

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
