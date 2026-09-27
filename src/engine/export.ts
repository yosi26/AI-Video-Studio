import type { Project } from '../types'
import { CANVAS_SIZE } from '../types'
import { playSoundtrack } from './music'
import { renderFrame, totalDuration } from './render'

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

/**
 * Record the project in real time to a video Blob.
 * The tab must stay visible: browsers throttle animation frames in background tabs.
 */
export async function exportVideo(project: Project, onProgress: (p: number) => void): Promise<Blob> {
  const mimeType = pickMimeType()
  if (!mimeType) throw new Error('הדפדפן הזה לא תומך בהקלטת וידאו. נסה Chrome או Edge.')

  const { w, h } = CANVAS_SIZE[project.aspect]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const total = totalDuration(project)

  const stream = canvas.captureStream(30)
  let actx: AudioContext | null = null
  let music: ReturnType<typeof playSoundtrack> | null = null
  if (project.music) {
    actx = new AudioContext()
    const dest = actx.createMediaStreamDestination()
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
    music = playSoundtrack(actx, dest, total)
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] }))
  })

  renderFrame(ctx, project, 0)
  recorder.start(250)
  const start = performance.now()

  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000
      renderFrame(ctx, project, t)
      onProgress(Math.min(1, t / total))
      if (t >= total) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  recorder.stop()
  music?.stop()
  const blob = await done
  stream.getTracks().forEach((t) => t.stop())
  await actx?.close()
  return blob
}
