// Settings shared by the form (browser) and the API route (server).
// Values come from Google's Gemini Omni Flash reference:
// 16:9 or 9:16, 360p–4k (default 720p), 3–10 seconds.

export const ASPECT_RATIOS = [
  { value: "16:9", label: "לרוחב 16:9" },
  { value: "9:16", label: "לאורך 9:16" },
] as const;

export const RESOLUTIONS = [
  { value: "360p", label: "360p · מהיר" },
  { value: "720p", label: "720p · מומלץ" },
  { value: "1080p", label: "1080p · Full HD" },
  { value: "4k", label: "4K · איטי" },
] as const;

export const MIN_DURATION = 3;
export const MAX_DURATION = 10;
export const DEFAULT_DURATION = 8;

export const MAX_PROMPT_LENGTH = 4000;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number]["value"];
export type Resolution = (typeof RESOLUTIONS)[number]["value"];

export function isAspectRatio(value: unknown): value is AspectRatio {
  return ASPECT_RATIOS.some((option) => option.value === value);
}

export function isResolution(value: unknown): value is Resolution {
  return RESOLUTIONS.some((option) => option.value === value);
}

/** What the API route returns after a successful generation. */
export type GenerateResponse = {
  interactionId: string;
  fileId: string;
};

export type ErrorResponse = { error: string };
