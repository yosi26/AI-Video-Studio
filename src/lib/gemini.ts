// Server-only helpers for Gemini Omni Flash. Never import this from a client component:
// it reads GEMINI_API_KEY.
import { GoogleGenAI } from "@google/genai";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import type { AspectRatio, Resolution } from "./options";

export const MODEL = "gemini-omni-1.1-flash";
const API_BASE = "https://generativelanguage.googleapis.com";
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

// A video can take several minutes before Gemini sends the first byte back.
// Node's built-in fetch gives up after 5 minutes by default, so raise that limit.
// EnvHttpProxyAgent also honours HTTPS_PROXY / NO_PROXY for people behind a proxy.
setGlobalDispatcher(
  new EnvHttpProxyAgent({ headersTimeout: GENERATION_TIMEOUT_MS, bodyTimeout: GENERATION_TIMEOUT_MS }),
);

export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new UserFacingError(
      "חסר מפתח Gemini API. צרו קובץ ‎.env.local עם GEMINI_API_KEY=המפתח שלכם והפעילו את השרת מחדש.",
      500,
    );
  }
  return key;
}

function client(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: apiKey(), httpOptions: { timeout: GENERATION_TIMEOUT_MS } });
}

/** Pulls the file id out of a Files API name or URI ("files/abc123" → "abc123"). */
export function fileIdFrom(uriOrName: string | undefined): string | undefined {
  return uriOrName?.match(/files\/([a-z0-9-]+)/i)?.[1];
}

export function isValidFileId(id: string): boolean {
  return /^[a-z0-9-]{1,64}$/i.test(id);
}

export function isValidInteractionId(id: string): boolean {
  return /^[\w.-]{1,256}$/.test(id);
}

type UploadedImage = { uri: string; mimeType: string };

/** Uploads an image to the Files API and waits until Gemini can use it. */
async function uploadImage(ai: GoogleGenAI, image: File): Promise<UploadedImage> {
  let file = await ai.files.upload({ file: image, config: { mimeType: image.type } });
  const deadline = Date.now() + 2 * 60 * 1000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: file.name! });
  }
  const id = fileIdFrom(file.uri ?? file.name);
  if (file.state === "FAILED" || !id) {
    throw new UserFacingError("העלאת התמונה ל-Gemini נכשלה. נסו תמונה אחרת.", 502);
  }
  if (file.state !== "ACTIVE") {
    throw new UserFacingError("עיבוד התמונה ב-Gemini לקח יותר מדי זמן. נסו שוב.", 504);
  }
  return { uri: `${API_BASE}/files/${id}`, mimeType: file.mimeType ?? image.type };
}

export type GenerateOptions = {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  /** Seconds, 3–10. Left out for edits so the model keeps the source length. */
  duration?: number;
  firstFrame?: File;
  lastFrame?: File;
  /** Continue from an earlier video (edit or extend it) instead of starting fresh. */
  previousInteractionId?: string;
};

export async function generateVideo(options: GenerateOptions) {
  const ai = client();

  const input: Array<
    { type: "text"; text: string } | { type: "image"; uri: string; mime_type: string }
  > = [];
  let prompt = options.prompt;

  if (options.firstFrame) {
    const first = await uploadImage(ai, options.firstFrame);
    input.push({ type: "image", uri: first.uri, mime_type: first.mimeType });
    if (options.lastFrame) {
      const last = await uploadImage(ai, options.lastFrame);
      input.push({ type: "image", uri: last.uri, mime_type: last.mimeType });
      prompt = `<FIRST_FRAME> <LAST_FRAME> ${prompt}`;
    } else {
      prompt = `<FIRST_FRAME> ${prompt}`;
    }
  }
  input.push({ type: "text", text: prompt });

  const interaction = await ai.interactions.create({
    model: MODEL,
    input,
    response_format: {
      type: "video",
      delivery: "uri",
      aspect_ratio: options.aspectRatio,
      resolution: options.resolution,
      ...(options.duration ? { duration: `${options.duration}s` } : {}),
    },
    ...(options.previousInteractionId
      ? { previous_interaction_id: options.previousInteractionId }
      : {}),
  });

  const fileId = fileIdFrom(interaction.output_video?.uri);
  if (!fileId) {
    const reason = interaction.errors?.map((e) => e.message).filter(Boolean).join(" ");
    throw new UserFacingError(
      reason
        ? `Gemini לא החזיר סרטון: ${sanitize(reason)}`
        : "Gemini לא החזיר סרטון. ייתכן שהתיאור נחסם על ידי מסנני הבטיחות. נסו לנסח אחרת.",
      502,
    );
  }
  return { interactionId: interaction.id, fileId };
}

/** Streams a generated video from the Files API, passing Range through so the player can seek. */
export async function fetchVideo(fileId: string, range: string | null): Promise<Response> {
  return fetch(`${API_BASE}/v1beta/files/${fileId}:download?alt=media`, {
    headers: { "x-goog-api-key": apiKey(), ...(range ? { range } : {}) },
  });
}

/** Removes the API key and anything that looks like a credential from text shown to users. */
function sanitize(text: string): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  let clean = key && key.length >= 8 ? text.split(key).join("[key]") : text;
  clean = clean
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[key]")
    .replace(/([?&](?:key|access_token)=)[^&\s"']+/gi, "$1[key]")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 400 ? `${clean.slice(0, 397)}...` : clean;
}

/** Reads `error.message` out of a Google API error body (`{error}` or `[{error}]`). */
export function googleErrorMessage(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    const first = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: unknown } };
    return typeof first?.error?.message === "string" ? first.error.message : undefined;
  } catch {
    return undefined;
  }
}

/** Turns any thrown error into a Hebrew message and an HTTP status for the browser. */
export function toUserError(error: unknown): UserFacingError {
  if (error instanceof UserFacingError) return error;

  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : undefined;
  // Interactions API errors keep Google's message in `body`; `message` is a generic wrapper.
  const body = (error as { body?: unknown })?.body;
  const detail = typeof body === "string" ? googleErrorMessage(body) : undefined;
  const raw = sanitize(detail ?? (error instanceof Error ? error.message : String(error)));

  if (status === 401 || status === 403 || /api[ _]?key/i.test(raw)) {
    return new UserFacingError(
      "מפתח ה-API לא תקין, או שאין לו גישה ל-Gemini Omni Flash. בדקו את המפתח ב-Google AI Studio.",
      status ?? 401,
    );
  }
  if (status === 429) {
    return new UserFacingError("חרגתם ממכסת השימוש של Gemini. חכו כמה דקות ונסו שוב.", 429);
  }
  if (status === 404 && /model/i.test(raw)) {
    return new UserFacingError(`המודל ${MODEL} לא זמין לחשבון הזה. (${raw})`, 404);
  }
  if (status === 400) {
    return new UserFacingError(`Gemini דחה את הבקשה: ${raw}`, 400);
  }
  if (/timeout|timed out|UND_ERR/i.test(raw)) {
    return new UserFacingError(
      "היצירה לקחה יותר מדי זמן. נסו רזולוציה נמוכה יותר או סרטון קצר יותר.",
      504,
    );
  }
  return new UserFacingError(`משהו השתבש מול Gemini: ${raw}`, status && status >= 400 ? status : 500);
}
