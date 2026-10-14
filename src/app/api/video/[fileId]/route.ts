import { fetchVideo, googleErrorMessage, isValidFileId, toUserError } from "@/lib/gemini";

export const runtime = "nodejs";

const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!isValidFileId(fileId)) {
    return Response.json({ error: "מזהה סרטון לא תקין." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchVideo(fileId, request.headers.get("range"));
  } catch (error) {
    const userError = toUserError(error);
    return Response.json({ error: userError.message }, { status: userError.status });
  }

  if (!upstream.ok || !upstream.body) {
    // Read the error body instead of cancelling it: cancel() never settles inside Next.js.
    const detail = googleErrorMessage(await upstream.text().catch(() => ""));
    if (upstream.status === 404) {
      return Response.json(
        { error: "הסרטון כבר לא זמין. Google שומרת סרטונים שנוצרו לזמן מוגבל בלבד." },
        { status: 404 },
      );
    }
    const userError = toUserError(
      Object.assign(new Error(detail ?? `HTTP ${upstream.status}`), { status: upstream.status }),
    );
    return Response.json({ error: userError.message }, { status: userError.status });
  }

  const headers = new Headers({ "cache-control": "private, max-age=3600" });
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  const download = new URL(request.url).searchParams.has("download");
  headers.set(
    "content-disposition",
    `${download ? "attachment" : "inline"}; filename="ai-video-${fileId}.mp4"`,
  );

  return new Response(upstream.body, { status: upstream.status, headers });
}
