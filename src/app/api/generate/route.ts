import { generateVideo, isValidInteractionId, toUserError, UserFacingError } from "@/lib/gemini";
import {
  DEFAULT_DURATION,
  IMAGE_TYPES,
  isAspectRatio,
  isResolution,
  MAX_DURATION,
  MAX_IMAGE_BYTES,
  MAX_PROMPT_LENGTH,
  MIN_DURATION,
  type ErrorResponse,
  type GenerateResponse,
} from "@/lib/options";

export const runtime = "nodejs";
// Generation usually takes a minute or two, 4K and long videos longer.
export const maxDuration = 300;

function optionalImage(form: FormData, field: string, label: string): File | undefined {
  const value = form.get(field);
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (!(IMAGE_TYPES as readonly string[]).includes(value.type)) {
    throw new UserFacingError(`${label}: אפשר להעלות רק PNG, JPEG או WebP.`, 400);
  }
  if (value.size > MAX_IMAGE_BYTES) {
    throw new UserFacingError(`${label}: הקובץ גדול מ-20MB.`, 400);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const prompt = String(form.get("prompt") ?? "").trim();
    if (!prompt) throw new UserFacingError("כתבו תיאור לסרטון.", 400);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new UserFacingError(`התיאור ארוך מדי (עד ${MAX_PROMPT_LENGTH} תווים).`, 400);
    }

    const aspectRatio = form.get("aspectRatio");
    if (!isAspectRatio(aspectRatio)) throw new UserFacingError("יחס התמונה לא תקין.", 400);

    const resolution = form.get("resolution");
    if (!isResolution(resolution)) throw new UserFacingError("הרזולוציה לא תקינה.", 400);

    const previousInteractionId = String(form.get("previousInteractionId") ?? "") || undefined;
    if (previousInteractionId && !isValidInteractionId(previousInteractionId)) {
      throw new UserFacingError("מזהה הסרטון הקודם לא תקין.", 400);
    }

    // Edits keep the length of the video they continue from unless one is asked for.
    const durationField = form.get("duration");
    let duration: number | undefined;
    if (durationField !== null && durationField !== "") {
      duration = Number(durationField);
      if (!Number.isInteger(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
        throw new UserFacingError(`האורך חייב להיות בין ${MIN_DURATION} ל-${MAX_DURATION} שניות.`, 400);
      }
    } else if (!previousInteractionId) {
      duration = DEFAULT_DURATION;
    }

    const firstFrame = optionalImage(form, "firstFrame", "תמונת הפתיחה");
    const lastFrame = optionalImage(form, "lastFrame", "תמונת הסיום");
    if (lastFrame && !firstFrame) {
      throw new UserFacingError("תמונת סיום עובדת רק יחד עם תמונת פתיחה.", 400);
    }
    if (previousInteractionId && (firstFrame || lastFrame)) {
      throw new UserFacingError("בעריכה של סרטון קיים אי אפשר להוסיף תמונות.", 400);
    }

    const result = await generateVideo({
      prompt,
      aspectRatio,
      resolution,
      duration,
      firstFrame,
      lastFrame,
      previousInteractionId,
    });
    return Response.json(result satisfies GenerateResponse);
  } catch (error) {
    const userError = toUserError(error);
    if (userError.status >= 500) console.error("[generate]", error);
    return Response.json({ error: userError.message } satisfies ErrorResponse, {
      status: userError.status,
    });
  }
}
