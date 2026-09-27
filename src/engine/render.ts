import type { Look, Motion, Project, Scene } from '../types'
import { CANVAS_SIZE } from '../types'

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/** Start time of each scene; consecutive scenes overlap by the transition length. */
export function sceneStarts(project: Project): number[] {
  const starts: number[] = []
  let t = 0
  for (const s of project.scenes) {
    starts.push(t)
    t += s.duration - project.transition
  }
  return starts
}

export function totalDuration(project: Project): number {
  if (project.scenes.length === 0) return 0
  const sum = project.scenes.reduce((acc, s) => acc + s.duration, 0)
  return sum - project.transition * (project.scenes.length - 1)
}

const LOOK_FILTER: Record<Look, string> = {
  none: 'none',
  cinematic: 'contrast(1.12) saturate(1.15) brightness(0.97)',
  warm: 'sepia(0.18) saturate(1.25) contrast(1.05)',
  bw: 'grayscale(1) contrast(1.2) brightness(1.02)',
  vintage: 'sepia(0.45) contrast(0.92) saturate(0.85) brightness(1.04)',
}

let grainCanvas: HTMLCanvasElement | null = null
function getGrain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const data = g.createImageData(256, 256)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  g.putImageData(data, 0, 0)
  grainCanvas = c
  return c
}

function motionTransform(motion: Motion, p: number) {
  const e = easeInOut(p)
  switch (motion) {
    case 'zoom-in':
      return { scale: 1 + 0.18 * e, dx: 0 }
    case 'zoom-out':
      return { scale: 1.18 - 0.18 * e, dx: 0 }
    case 'pan-left':
      return { scale: 1.2, dx: 0.08 - 0.16 * e }
    case 'pan-right':
      return { scale: 1.2, dx: -0.08 + 0.16 * e }
    default:
      return { scale: 1.04, dx: 0 }
  }
}

function drawImageScene(ctx: CanvasRenderingContext2D, scene: Scene, p: number, W: number, H: number) {
  const img = scene.image
  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, W, H)
    return
  }
  const { scale, dx } = motionTransform(scene.motion, p)
  const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight) * scale
  const dw = img.naturalWidth * cover
  const dh = img.naturalHeight * cover
  const x = (W - dw) / 2 + dx * W
  const y = (H - dh) / 2
  ctx.drawImage(img, x, y, dw, dh)
}

function drawTitleBackground(ctx: CanvasRenderingContext2D, accent: string, p: number, W: number, H: number) {
  ctx.fillStyle = '#0b0a10'
  ctx.fillRect(0, 0, W, H)
  const r = Math.max(W, H) * (0.55 + 0.1 * p)
  const g = ctx.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, r)
  g.addColorStop(0, hexToRgba(accent, 0.35))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawText(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  localT: number,
  W: number,
  H: number,
  accent: string,
  centered: boolean,
) {
  if (!scene.title && !scene.subtitle) return
  const inA = easeOut(clamp((localT - 0.3) / 0.9))
  const outA = clamp((scene.duration - localT) / 0.5)
  const alpha = Math.min(inA, outA)
  if (alpha <= 0) return

  const base = Math.min(W, H)
  const titleSize = Math.round(base * (centered ? 0.11 : 0.075))
  const subSize = Math.round(base * 0.038)
  const cy = centered ? H * 0.5 : H * 0.78
  const rise = (1 - inA) * base * 0.03

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (!centered) {
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.55, W, H * 0.45)
  }

  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = base * 0.02
  if (scene.title) {
    ctx.font = `800 ${titleSize}px "Frank Ruhl Libre", "Heebo", serif`
    ctx.fillStyle = '#fff'
    ctx.fillText(scene.title, W / 2, cy - (scene.subtitle ? titleSize * 0.35 : 0) + rise, W * 0.9)
  }
  if (scene.subtitle) {
    ctx.font = `400 ${subSize}px "Heebo", sans-serif`
    ctx.fillStyle = hexToRgba(accent, 1)
    ctx.fillText(scene.subtitle, W / 2, cy + titleSize * 0.55 + rise, W * 0.9)
  }
  if (centered && scene.title) {
    const lineW = W * 0.12 * inA
    ctx.shadowBlur = 0
    ctx.fillStyle = hexToRgba(accent, 0.9)
    ctx.fillRect(W / 2 - lineW / 2, cy - titleSize * 1.05 + rise, lineW, Math.max(2, base * 0.004))
  }
  ctx.restore()
}

function drawScene(ctx: CanvasRenderingContext2D, project: Project, scene: Scene, localT: number, W: number, H: number) {
  const p = clamp(localT / scene.duration)
  if (scene.kind === 'title') {
    drawTitleBackground(ctx, project.accent, p, W, H)
    drawText(ctx, scene, localT, W, H, project.accent, true)
  } else {
    ctx.save()
    ctx.filter = LOOK_FILTER[project.look]
    drawImageScene(ctx, scene, p, W, H)
    ctx.restore()
    drawText(ctx, scene, localT, W, H, project.accent, false)
  }
}

function drawPost(ctx: CanvasRenderingContext2D, project: Project, t: number, W: number, H: number) {
  if (project.look === 'cinematic') {
    // Teal shadows / orange highlights split-tone.
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, 'rgba(0,128,140,0.35)')
    g.addColorStop(1, 'rgba(255,140,40,0.35)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }
  if (project.look !== 'none') {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, project.look === 'vintage' ? 'rgba(30,15,0,0.6)' : 'rgba(0,0,0,0.5)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, W, H)
  }
  if (project.grain) {
    const grain = getGrain()
    ctx.save()
    ctx.globalAlpha = 0.07
    ctx.globalCompositeOperation = 'overlay'
    const ox = Math.floor((Math.sin(t * 91.7) * 0.5 + 0.5) * 256)
    const oy = Math.floor((Math.cos(t * 57.3) * 0.5 + 0.5) * 256)
    for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(grain, x, y)
    ctx.restore()
  }
  if (project.letterbox && project.aspect === '16:9') {
    const barH = (H - W / 2.39) / 2
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, barH)
    ctx.fillRect(0, H - barH, W, barH)
  }
}

/** Draw the whole composition at time t (seconds). */
export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, t: number) {
  const { w: W, h: H } = CANVAS_SIZE[project.aspect]
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  if (project.scenes.length === 0) return

  const starts = sceneStarts(project)
  const total = totalDuration(project)
  const time = clamp(t, 0, Math.max(0, total - 1e-3))

  project.scenes.forEach((scene, i) => {
    const local = time - starts[i]
    if (local < 0 || local > scene.duration) return
    const fadeIn = i === 0 || project.transition === 0 ? 1 : clamp(local / project.transition)
    ctx.save()
    ctx.globalAlpha = fadeIn
    drawScene(ctx, project, scene, local, W, H)
    ctx.restore()
  })

  drawPost(ctx, project, time, W, H)

  // Global fade from/to black.
  const edge = Math.min(clamp(time / 0.6), clamp((total - time) / 0.8))
  if (edge < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - edge})`
    ctx.fillRect(0, 0, W, H)
  }
}

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
