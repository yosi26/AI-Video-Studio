// BudgetPixel catalog snapshot (September 2026). Prices are base credits
// before plan discounts; refresh when the provider changes them.

export type ModelKind = 'image' | 'video' | 'music' | 'sfx'

export interface ModelInfo {
  id: string
  name: string
  kind: ModelKind
  note: string
  /** image: per image · music: per track */
  flat?: number
  /** video / sfx: credits per second, keyed by resolution for video */
  perSecond?: Record<string, number>
  minSeconds?: number
  maxSeconds?: number
  maxRefs?: number
}

export const MODELS: ModelInfo[] = [
  { id: 'flux-2-klein', name: 'FLUX 2 Klein', kind: 'image', flat: 10, maxRefs: 3, note: 'טיוטות מהירות וזולות, שומר פנים לא רע' },
  { id: 'p-image', name: 'P-Image', kind: 'image', flat: 10, note: 'הכי זול, טקסט לתמונה בלבד' },
  { id: 'muse-image-1.0', name: 'Muse Image 1.0', kind: 'image', flat: 12, maxRefs: 4, note: 'טיפוגרפיה מצוינת ועובדות מהעולם האמיתי' },
  { id: 'z-image-turbo', name: 'Z-Image Turbo', kind: 'image', flat: 15, note: 'מהיר, מסוגנן' },
  { id: 'flux-2-pro', name: 'FLUX 2 Pro', kind: 'image', flat: 25, maxRefs: 1, note: 'איכות גבוהה במחיר סביר' },
  { id: 'kling-v3-omni', name: 'Kling v3 Omni', kind: 'image', flat: 35, maxRefs: 9, note: 'עד 9 תמונות רפרנס' },
  { id: 'gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare', kind: 'image', flat: 40, maxRefs: 9, note: 'עריכות מדויקות, טקסט טבעי' },
  { id: 'seedream-5.0-pro', name: 'SeeDream 5.0 Pro', kind: 'image', flat: 55, maxRefs: 9, note: 'שמירת זהות הכי חזקה' },
  { id: 'nano-banana-2', name: 'Nano Banana 2', kind: 'image', flat: 65, maxRefs: 9, note: 'פוטוריאליזם ועריכה ברמה הגבוהה ביותר' },

  { id: 'wan-3.0-video', name: 'Wan 3.0', kind: 'video', perSecond: { '480p': 60, '720p': 120, '1080p': 240 }, minSeconds: 2, maxSeconds: 30, maxRefs: 10, note: 'הכי משתלם, כולל סאונד, רפרנסים בחינם' },
  { id: 'seedance-2.0-mini', name: 'SeeDance 2.0 Mini', kind: 'video', perSecond: { '480p': 60, '720p': 120 }, minSeconds: 4, maxSeconds: 15, maxRefs: 9, note: 'טיוטות וידאו זולות' },
  { id: 'minimax-h3-max', name: 'MiniMax H3 Max', kind: 'video', perSecond: { '480p': 65, '768p': 105, '1080p': 210, '2k': 420 }, minSeconds: 5, maxSeconds: 15, maxRefs: 5, note: 'יכול גם להאריך סרטון קיים' },
  { id: 'wan-3.0-video-prime', name: 'Wan 3.0 Prime', kind: 'video', perSecond: { '480p': 85, '720p': 170, '1080p': 340 }, minSeconds: 2, maxSeconds: 30, maxRefs: 10, note: 'Wan 3.0 אבל מהיר יותר' },
  { id: 'seedance-2.0', name: 'SeeDance 2.0', kind: 'video', perSecond: { '480p': 100, '720p': 220, '1080p': 550, '4k': 1250 }, minSeconds: 4, maxSeconds: 15, maxRefs: 9, note: 'עריכת וידאו-לוידאו, עד 4K' },
  { id: 'seedance-2.5', name: 'SeeDance 2.5', kind: 'video', perSecond: { '480p': 150, '720p': 330, '1080p': 750 }, minSeconds: 4, maxSeconds: 30, maxRefs: 15, note: 'ספינת הדגל, הכי איכותי' },

  { id: 'mureka-v9', name: 'Mureka V9', kind: 'music', flat: 60, note: 'שיר מלא עם או בלי שירה' },
  { id: 'lyria-3', name: 'Lyria 3', kind: 'music', flat: 100, note: 'Google, שירה בלבד' },
  { id: 'music-3.0', name: 'Music 3.0', kind: 'music', flat: 200, note: 'איכות הפקה גבוהה, גם אינסטרומנטלי' },

  { id: 'sonilo-sfx', name: 'Sonilo SFX', kind: 'sfx', perSecond: { default: 5 }, minSeconds: 3, maxSeconds: 180, note: 'אפקטים מטקסט' },
  { id: 'sonilo-video-sfx', name: 'Sonilo Video SFX', kind: 'sfx', perSecond: { default: 15 }, minSeconds: 3, maxSeconds: 360, note: 'אפקטים מסונכרנים לסרטון' },
]

export function estimateCost(model: ModelInfo, opts: { resolution?: string; seconds?: number; count?: number }): number {
  const count = opts.count ?? 1
  if (model.flat !== undefined) return model.flat * count
  const rates = model.perSecond ?? {}
  const rate = rates[opts.resolution ?? ''] ?? Object.values(rates)[0] ?? 0
  const secs = Math.max(model.minSeconds ?? 0, opts.seconds ?? model.minSeconds ?? 1)
  return rate * secs * count
}
