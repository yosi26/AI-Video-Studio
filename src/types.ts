export type Motion = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'
export type Aspect = '16:9' | '9:16' | '1:1'
export type Look = 'none' | 'cinematic' | 'warm' | 'bw' | 'vintage'

export interface Scene {
  id: string
  kind: 'image' | 'title'
  /** Object URL of the uploaded image (image scenes only). */
  src?: string
  image?: HTMLImageElement
  name?: string
  duration: number
  motion: Motion
  title: string
  subtitle: string
}

export interface Project {
  scenes: Scene[]
  aspect: Aspect
  look: Look
  /** Crossfade length between scenes, in seconds. */
  transition: number
  letterbox: boolean
  grain: boolean
  music: boolean
  accent: string
}

export const CANVAS_SIZE: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '1:1': { w: 1080, h: 1080 },
}
