import { useMemo, useState } from 'react'
import { MODELS, estimateCost, type ModelKind } from '../models'

const KINDS: { id: ModelKind; label: string }[] = [
  { id: 'image', label: 'תמונה' },
  { id: 'video', label: 'וידאו' },
  { id: 'music', label: 'מוזיקה' },
  { id: 'sfx', label: 'אפקטים' },
]

const CAMERA = ['slow dolly-in', 'slow orbit around the subject', 'handheld tracking shot', 'aerial drone pull-back', 'static locked-off shot', 'crane up reveal']
const LIGHT = ['golden hour sunset', 'blue hour, city lights', 'soft window light', 'neon night', 'overcast moody', 'harsh desert noon']
const STYLE = ['photorealistic film still, anamorphic lens, film grain', 'teal-and-orange blockbuster grade', 'black-and-white documentary', 'warm 90s VHS home video', 'Pixar-style 3D animation', 'Studio Ghibli watercolor']

export default function Planner() {
  const [kind, setKind] = useState<ModelKind>('video')
  const models = MODELS.filter((m) => m.kind === kind)
  const [modelId, setModelId] = useState('wan-3.0-video')
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const resolutions = model.kind === 'video' ? Object.keys(model.perSecond ?? {}) : []
  const [resolution, setResolution] = useState('480p')
  const res = resolutions.includes(resolution) ? resolution : resolutions[0]
  const [seconds, setSeconds] = useState(4)
  const [count, setCount] = useState(1)
  const [balance, setBalance] = useState(40)

  const [subject, setSubject] = useState('the man from the reference photo (same face, beard, glasses, kippah)')
  const [place, setPlace] = useState('a Jerusalem stone rooftop overlooking the Old City')
  const [action, setAction] = useState('turns toward the camera with a warm confident smile')
  const [camera, setCamera] = useState(CAMERA[0])
  const [light, setLight] = useState(LIGHT[0])
  const [style, setStyle] = useState(STYLE[0])
  const [copied, setCopied] = useState(false)

  const secs = Math.min(model.maxSeconds ?? 60, Math.max(model.minSeconds ?? 1, seconds))
  const cost = estimateCost(model, { resolution: res, seconds: secs, count })
  const affordable = cost > 0 ? Math.floor(balance / cost) : 0

  const prompt = useMemo(() => {
    if (kind === 'music') return `Cinematic instrumental score, ${light.includes('night') ? 'dark and pulsing' : 'warm and hopeful'}, slow build, strings and soft piano, for a video of ${subject} on ${place}.`
    if (kind === 'sfx') return `Ambient sound for ${place}: soft wind, distant city, faint birds.`
    const parts = [`${subject} on ${place}`, kind === 'video' ? `${action}. Camera: ${camera}` : action, `Lighting: ${light}`, `Style: ${style}`]
    return parts.join('. ') + '.'
  }, [kind, subject, place, action, camera, light, style])

  const copy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="planner">
      <section className="card">
        <h2>1. מה יוצרים?</h2>
        <div className="chips">
          {KINDS.map((k) => (
            <button
              key={k.id}
              className={`chip ${kind === k.id ? 'on' : ''}`}
              onClick={() => {
                setKind(k.id)
                setModelId(MODELS.find((m) => m.kind === k.id)!.id)
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <h2>2. מודל</h2>
        <div className="model-list">
          {models.map((m) => (
            <button key={m.id} className={`model ${m.id === model.id ? 'on' : ''}`} onClick={() => setModelId(m.id)}>
              <strong>{m.name}</strong>
              <span>{m.note}</span>
              <em dir="ltr">{m.flat !== undefined ? `${m.flat} cr` : `${Object.values(m.perSecond ?? {})[0]}+ cr/s`}</em>
            </button>
          ))}
        </div>

        <div className="row wrap">
          {resolutions.length > 0 && (
            <label>
              רזולוציה{' '}
              <select value={res} onChange={(e) => setResolution(e.target.value)}>
                {resolutions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          {model.perSecond && (
            <label>
              שניות{' '}
              <input type="number" min={model.minSeconds} max={model.maxSeconds} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
            </label>
          )}
          <label>
            כמות <input type="number" min={1} max={4} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
          </label>
          <label>
            יתרה שלי <input type="number" min={0} value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
          </label>
        </div>

        <div className={`cost ${cost > balance ? 'over' : ''}`}>
          <span>עלות משוערת</span>
          <strong dir="ltr">{cost.toLocaleString()} קרדיטים</strong>
          <span>{cost > balance ? `חסרים ${(cost - balance).toLocaleString()}` : `אפשר להריץ ${affordable} פעמים ביתרה הנוכחית`}</span>
        </div>
      </section>

      <section className="card">
        <h2>3. בונה פרומפט</h2>
        <label className="field">
          מי / מה
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="field">
          איפה
          <input value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
        {kind !== 'music' && kind !== 'sfx' && (
          <label className="field">
            מה קורה
            <input value={action} onChange={(e) => setAction(e.target.value)} />
          </label>
        )}
        <div className="row wrap">
          {kind === 'video' && (
            <label>
              מצלמה{' '}
              <select value={camera} onChange={(e) => setCamera(e.target.value)}>
                {CAMERA.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            תאורה{' '}
            <select value={light} onChange={(e) => setLight(e.target.value)}>
              {LIGHT.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {(kind === 'image' || kind === 'video') && (
            <label>
              סגנון{' '}
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                {STYLE.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <pre className="prompt" dir="ltr">
          {prompt}
        </pre>
        <button className="btn primary" onClick={copy}>
          {copied ? '✓ הועתק' : 'העתק פרומפט'}
        </button>
        <p className="hint">
          פרומפטים באנגלית עובדים טוב יותר ברוב המודלים. הדבק את הפרומפט ל-Claude יחד עם שם המודל, והוא יריץ אותו דרך החשבון המחובר שלך.
        </p>
      </section>
    </div>
  )
}
