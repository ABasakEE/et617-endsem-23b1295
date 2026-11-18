// The model proposes which words to box; only words that really occur in the shown text survive.
export function cleanHighlights(text, raw) {
  if (!Array.isArray(raw)) return []
  const lower = text.toLowerCase(), out = []
  for (const w of raw) {
    if (typeof w !== 'string') continue
    const t = w.trim()
    if (t.length < 2 || t.length > 30 || t.split(/\s+/).length > 3) continue
    if (!lower.includes(t.toLowerCase()) || out.some((o) => o.toLowerCase() === t.toLowerCase())) continue
    out.push(t)
    if (out.length === 3) break
  }
  return out
}
