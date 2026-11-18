import { useState } from 'react'

const ID = '23B1295'

function Footer({ onAbout }) {
  return (
    <footer style={{ marginTop: 32, padding: 12, borderTop: '1px solid #ccc', fontSize: 13 }}>
      ID {ID} · ET617 End-sem · <button onClick={onAbout}>About</button>
    </footer>
  )
}

export default function App() {
  const [about, setAbout] = useState(false)
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '0 auto', padding: 16 }}>
      {about ? (
        <section>
          <h1>About</h1>
          <p>Newton's Traps: an adaptive tutor for Newton's laws (Class 9).</p>
          <p>Identity token: <b>{ID}</b></p>
          <p>Card: P4 · Newton's laws · L5 · C4</p>
          <button onClick={() => setAbout(false)}>Back</button>
        </section>
      ) : (
        <section>
          <h1>Newton's Traps</h1>
          <p>Skeleton deployed. Session flow coming next.</p>
        </section>
      )}
      <Footer onAbout={() => setAbout(true)} />
    </main>
  )
}
