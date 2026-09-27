import { useState } from 'react'
import Planner from './components/Planner'
import Studio from './components/Studio'

type Tab = 'studio' | 'planner'

export default function App() {
  const [tab, setTab] = useState<Tab>('studio')
  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">▶</span>
          <div>
            <h1>AI Video Studio</h1>
            <p>סרטונים קולנועיים מתמונות וטקסט</p>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'studio'} className={tab === 'studio' ? 'on' : ''} onClick={() => setTab('studio')}>
            🎬 סטודיו חינמי
          </button>
          <button role="tab" aria-selected={tab === 'planner'} className={tab === 'planner' ? 'on' : ''} onClick={() => setTab('planner')}>
            ✨ מתכנן AI
          </button>
        </nav>
      </header>
      <main>{tab === 'studio' ? <Studio /> : <Planner />}</main>
      <footer className="foot">הסטודיו רץ כולו בדפדפן. התמונות שלך לא נשלחות לשום שרת.</footer>
    </div>
  )
}
