import { useEffect, useRef, useState } from 'react'
import { exportVideo, pickMimeType } from '../engine/export'
import { playSoundtrack, type MusicHandle } from '../engine/music'
import { renderFrame, sceneStarts, totalDuration } from '../engine/render'
import type { Aspect, Look, Motion, Project, Scene } from '../types'
import { CANVAS_SIZE } from '../types'

const MOTIONS: { id: Motion; label: string }[] = [
  { id: 'zoom-in', label: 'זום פנימה' },
  { id: 'zoom-out', label: 'זום החוצה' },
  { id: 'pan-left', label: 'תנועה שמאלה' },
  { id: 'pan-right', label: 'תנועה ימינה' },
  { id: 'static', label: 'סטטי' },
]

const LOOKS: { id: Look; label: string }[] = [
  { id: 'cinematic', label: 'קולנועי' },
  { id: 'warm', label: 'חמים' },
  { id: 'bw', label: 'שחור-לבן' },
  { id: 'vintage', label: 'וינטג׳' },
  { id: 'none', label: 'ללא' },
]

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: '16:9', label: '16:9 יוטיוב' },
  { id: '9:16', label: '9:16 רילס' },
  { id: '1:1', label: '1:1 פיד' },
]

const uid = () => Math.random().toString(36).slice(2, 9)

const introScene = (): Scene => ({
  id: uid(),
  kind: 'title',
  duration: 3.5,
  motion: 'static',
  title: 'הסיפור שלי',
  subtitle: 'AI Video Studio',
})

export default function Studio() {
  const [project, setProject] = useState<Project>({
    scenes: [introScene()],
    aspect: '16:9',
    look: 'cinematic',
    transition: 0.8,
    letterbox: true,
    grain: true,
    music: true,
    accent: '#ffb347',
  })
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState<number | null>(null)
  const [result, setResult] = useState<{ url: string; ext: string } | null>(null)
  const [error, setError] = useState('')
  const [fontsReady, setFontsReady] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<{ actx: AudioContext; music: MusicHandle } | null>(null)
  const total = totalDuration(project)
  const { w, h } = CANVAS_SIZE[project.aspect]

  useEffect(() => {
    document.fonts.ready.then(() =>
      Promise.all([
        document.fonts.load('800 40px "Frank Ruhl Libre"', 'א'),
        document.fonts.load('400 20px "Heebo"', 'א'),
      ]).finally(() => setFontsReady(true)),
    )
  }, [])

  // Redraw whenever the project or playhead changes.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    // At t=0 the frame is fully faded to black, so show a poster frame while idle.
    const poster = !playing && time === 0 ? Math.min(1.5, total / 2) : time
    if (ctx) renderFrame(ctx, project, poster)
  }, [project, time, fontsReady, playing, total])

  // Playback loop.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const startAt = performance.now() - time * 1000
    const tick = () => {
      const t = (performance.now() - startAt) / 1000
      if (t >= total) {
        setTime(total)
        setPlaying(false)
        return
      }
      setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  useEffect(() => {
    if (playing && project.music && time < 0.1) {
      const actx = new AudioContext()
      audioRef.current = { actx, music: playSoundtrack(actx, actx.destination, total) }
    }
    if (!playing && audioRef.current) {
      audioRef.current.music.stop()
      audioRef.current.actx.close()
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const update = (patch: Partial<Project>) => setProject((p) => ({ ...p, ...patch }))
  const updateScene = (id: string, patch: Partial<Scene>) =>
    setProject((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))

  const addImages = (files: FileList | null) => {
    if (!files) return
    const motions: Motion[] = ['zoom-in', 'pan-left', 'zoom-out', 'pan-right']
    const added: Scene[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file, i) => {
        const src = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => setProject((p) => ({ ...p }))
        image.src = src
        return {
          id: uid(),
          kind: 'image' as const,
          src,
          image,
          name: file.name,
          duration: 4,
          motion: motions[(project.scenes.length + i) % motions.length],
          title: '',
          subtitle: '',
        }
      })
    setProject((p) => ({ ...p, scenes: [...p.scenes, ...added] }))
  }

  const addTitle = () => setProject((p) => ({ ...p, scenes: [...p.scenes, { ...introScene(), title: 'להתראות', subtitle: '' }] }))

  const removeScene = (id: string) =>
    setProject((p) => {
      const s = p.scenes.find((x) => x.id === id)
      if (s?.src) URL.revokeObjectURL(s.src)
      return { ...p, scenes: p.scenes.filter((x) => x.id !== id) }
    })

  const moveScene = (id: string, dir: -1 | 1) =>
    setProject((p) => {
      const i = p.scenes.findIndex((s) => s.id === id)
      const j = i + dir
      if (j < 0 || j >= p.scenes.length) return p
      const scenes = [...p.scenes]
      ;[scenes[i], scenes[j]] = [scenes[j], scenes[i]]
      return { ...p, scenes }
    })

  const togglePlay = () => {
    if (!playing && time >= total - 0.05) setTime(0)
    setPlaying((v) => !v)
  }

  const onExport = async () => {
    setError('')
    setPlaying(false)
    if (result) URL.revokeObjectURL(result.url)
    setResult(null)
    setExporting(0)
    try {
      const blob = await exportVideo(project, setExporting)
      setResult({ url: URL.createObjectURL(blob), ext: blob.type.includes('mp4') ? 'mp4' : 'webm' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(null)
    }
  }

  const starts = sceneStarts(project)
  const format = pickMimeType().includes('mp4') ? 'MP4' : 'WebM'

  return (
    <div className="studio">
      <section className="stage">
        <div className="canvas-wrap" style={{ aspectRatio: `${w} / ${h}` }}>
          <canvas ref={canvasRef} width={w} height={h} />
        </div>

        <div className="transport">
          <button className="btn primary round" onClick={togglePlay} disabled={exporting !== null || total === 0} aria-label={playing ? 'השהה' : 'נגן'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={total || 1}
            step={0.01}
            value={time}
            onChange={(e) => {
              setPlaying(false)
              setTime(Number(e.target.value))
            }}
            aria-label="ציר זמן"
          />
          <span className="time" dir="ltr">
            {time.toFixed(1)} / {total.toFixed(1)}s
          </span>
        </div>

        <div className="export-row">
          <button className="btn primary big" onClick={onExport} disabled={exporting !== null || total === 0}>
            {exporting !== null ? `מייצא… ${Math.round(exporting * 100)}%` : `🎬 ייצא סרטון (${format})`}
          </button>
          {exporting !== null && <p className="hint">הייצוא רץ בזמן אמת. השאר את הלשונית פתוחה ומוצגת.</p>}
          {error && <p className="error">{error}</p>}
          {result && (
            <div className="result">
              <video src={result.url} controls playsInline />
              <a className="btn" href={result.url} download={`ai-video-studio.${result.ext}`}>
                ⬇ הורד את הסרטון
              </a>
            </div>
          )}
        </div>
      </section>

      <aside className="panel">
        <h2>סגנון</h2>
        <div className="chips" role="group" aria-label="יחס מסך">
          {ASPECTS.map((a) => (
            <button key={a.id} className={`chip ${project.aspect === a.id ? 'on' : ''}`} onClick={() => update({ aspect: a.id })}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="מראה">
          {LOOKS.map((l) => (
            <button key={l.id} className={`chip ${project.look === l.id ? 'on' : ''}`} onClick={() => update({ look: l.id })}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="toggles">
          <label>
            <input type="checkbox" checked={project.music} onChange={(e) => update({ music: e.target.checked })} /> מוזיקה
          </label>
          <label>
            <input type="checkbox" checked={project.grain} onChange={(e) => update({ grain: e.target.checked })} /> גרעיניות פילם
          </label>
          <label>
            <input
              type="checkbox"
              checked={project.letterbox}
              disabled={project.aspect !== '16:9'}
              onChange={(e) => update({ letterbox: e.target.checked })}
            />{' '}
            פסים שחורים
          </label>
          <label>
            צבע <input type="color" value={project.accent} onChange={(e) => update({ accent: e.target.value })} />
          </label>
        </div>
        <label className="field">
          מעבר בין סצנות: {project.transition.toFixed(1)} שנ׳
          <input type="range" min={0} max={1.5} step={0.1} value={project.transition} onChange={(e) => {
              const shortest = Math.min(...project.scenes.map((s) => s.duration))
              update({ transition: Math.min(Number(e.target.value), Math.max(0, shortest - 0.5)) })
            }} />
        </label>

        <h2>סצנות</h2>
        <div className="add-row">
          <label className="btn upload">
            + הוסף תמונות
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
          </label>
          <button className="btn" onClick={addTitle}>
            + כרטיס כותרת
          </button>
        </div>

        <ol className="scenes">
          {project.scenes.map((s, i) => (
            <li
              key={s.id}
              className="scene"
              onClick={() => {
                setPlaying(false)
                setTime(starts[i] + Math.min(1.5, s.duration / 2))
              }}
            >
              <div className="scene-head">
                {s.kind === 'image' ? <img src={s.src} alt="" /> : <div className="title-thumb">Aa</div>}
                <strong>{s.kind === 'image' ? `תמונה ${i + 1}` : 'כותרת'}</strong>
                <div className="scene-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => moveScene(s.id, -1)} aria-label="הזז למעלה">▲</button>
                  <button onClick={() => moveScene(s.id, 1)} aria-label="הזז למטה">▼</button>
                  <button onClick={() => removeScene(s.id)} aria-label="מחק">✕</button>
                </div>
              </div>
              <div className="scene-body" onClick={(e) => e.stopPropagation()}>
                <input placeholder="כותרת" value={s.title} onChange={(e) => updateScene(s.id, { title: e.target.value })} />
                <input placeholder="כותרת משנה" value={s.subtitle} onChange={(e) => updateScene(s.id, { subtitle: e.target.value })} />
                <div className="row">
                  {s.kind === 'image' && (
                    <select value={s.motion} onChange={(e) => updateScene(s.id, { motion: e.target.value as Motion })}>
                      {MOTIONS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <label>
                    <input
                      type="number"
                      min={1.5}
                      max={20}
                      step={0.5}
                      value={s.duration}
                      onChange={(e) => updateScene(s.id, { duration: Math.max(project.transition + 0.5, Number(e.target.value) || 1) })}
                    />{' '}
                    שנ׳
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {project.scenes.every((s) => s.kind !== 'image') && <p className="hint">העלה תמונות. כל תמונה הופכת לסצנה עם תנועת מצלמה.</p>}
      </aside>
    </div>
  )
}
