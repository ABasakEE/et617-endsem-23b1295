// Reports whether env vars are set, never their values. Use after adding Vercel env vars.
export default function handler(req, res) {
  res.status(200).json({ hasKey: !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || null })
}
