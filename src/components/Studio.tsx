"use client";

import { useEffect, useRef, useState } from "react";
import {
  ASPECT_RATIOS,
  DEFAULT_DURATION,
  IMAGE_TYPES,
  MAX_DURATION,
  MAX_PROMPT_LENGTH,
  MIN_DURATION,
  RESOLUTIONS,
  type AspectRatio,
  type ErrorResponse,
  type GenerateResponse,
  type Resolution,
} from "@/lib/options";

type HistoryEntry = GenerateResponse & {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  duration?: number;
  /** The interaction this video was edited from, if any. */
  parentId?: string;
  createdAt: number;
};

type Status =
  | { kind: "idle" }
  | { kind: "working"; startedAt: number; label: string }
  | { kind: "error"; message: string };

const HISTORY_KEY = "ai-video-studio:history";
const HISTORY_LIMIT = 30;

const EXAMPLES = [
  "צילום רחפן קולנועי מעל חוף ים בשקיעה, גלים מתנפצים על הסלעים, מוזיקה רגועה ברקע",
  "חתול ג'ינג'י פרוותי יושב על אדן חלון שטוף שמש ומביט בגינה. בשוט אחד רציף, בלי חיתוכים. בלי דיאלוג",
  "רחוב עתידני בלילה גשום, שלטי ניאון משתקפים בשלוליות, המצלמה מתקדמת לאט בין האנשים",
];

const EDIT_SUGGESTIONS = [
  "הפוך את הסרטון לסגנון אנימה",
  "תאורה דרמטית יותר. שאר הסרטון נשאר אותו דבר",
  "המשך את הסרטון",
];

function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Private mode or full storage: history just won't survive a reload.
  }
}

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function videoUrl(fileId: string, download = false) {
  return `/api/video/${encodeURIComponent(fileId)}${download ? "?download=1" : ""}`;
}

export default function Studio() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [firstFrame, setFirstFrame] = useState<File | null>(null);
  const [lastFrame, setLastFrame] = useState<File | null>(null);

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const working = status.kind === "working";
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const saved = loadHistory();
    setHistory(saved);
    setCurrent(saved[0] ?? null);
  }, []);

  async function generate(body: FormData, entry: Omit<HistoryEntry, keyof GenerateResponse | "createdAt">, label: string) {
    setStatus({ kind: "working", startedAt: Date.now(), label });
    // On phones the preview sits under the form, so bring the progress into view.
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const response = await fetch("/api/generate", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as GenerateResponse | ErrorResponse | null;
      if (!response.ok || !data || !("fileId" in data)) {
        const message = data && "error" in data ? data.error : `השרת החזיר שגיאה (${response.status}).`;
        setStatus({ kind: "error", message });
        return false;
      }
      const created: HistoryEntry = { ...entry, ...data, createdAt: Date.now() };
      setHistory((previous) => {
        const next = [created, ...previous].slice(0, HISTORY_LIMIT);
        saveHistory(next);
        return next;
      });
      setCurrent(created);
      setStatus({ kind: "idle" });
      return true;
    } catch {
      setStatus({
        kind: "error",
        message: "החיבור לשרת נותק לפני שהסרטון הסתיים. בדקו שהשרת רץ ונסו שוב.",
      });
      return false;
    }
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || working) return;

    const body = new FormData();
    body.set("prompt", text);
    body.set("aspectRatio", aspectRatio);
    body.set("resolution", resolution);
    body.set("duration", String(duration));
    if (firstFrame) body.set("firstFrame", firstFrame);
    if (firstFrame && lastFrame) body.set("lastFrame", lastFrame);

    void generate(body, { prompt: text, aspectRatio, resolution, duration }, "יוצר את הסרטון");
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    const text = editPrompt.trim();
    if (!text || working || !current) return;

    const body = new FormData();
    body.set("prompt", text);
    body.set("aspectRatio", current.aspectRatio);
    body.set("resolution", current.resolution);
    body.set("previousInteractionId", current.interactionId);

    const ok = await generate(
      body,
      {
        prompt: text,
        aspectRatio: current.aspectRatio,
        resolution: current.resolution,
        parentId: current.interactionId,
      },
      "עורך את הסרטון",
    );
    if (ok) setEditPrompt("");
  }

  function removeEntry(entry: HistoryEntry) {
    setHistory((previous) => {
      const next = previous.filter((item) => item.interactionId !== entry.interactionId);
      saveHistory(next);
      return next;
    });
    if (current?.interactionId === entry.interactionId) setCurrent(null);
  }

  return (
    <div className="page">
      <header className="header">
        <h1>
          AI Video Studio <span className="badge">Gemini Omni Flash</span>
        </h1>
        <p>כותבים מה רוצים לראות, ו-Gemini יוצר סרטון קולנועי עם סאונד. אפשר גם להתחיל מתמונה.</p>
      </header>

      <main className="layout">
        <form className="panel" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">מה יקרה בסרטון?</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="לדוגמה: צילום רחפן מעל יער ערפילי בזריחה, אור זהוב חודר בין העצים"
              rows={5}
              maxLength={MAX_PROMPT_LENGTH}
              disabled={working}
            />
          </label>
          <div className="chips" aria-label="דוגמאות">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="chip"
                onClick={() => setPrompt(example)}
                disabled={working}
              >
                {example.length > 42 ? `${example.slice(0, 42)}…` : example}
              </button>
            ))}
          </div>

          <div className="frames">
            <ImagePicker
              label="תמונת פתיחה"
              hint="הסרטון יתחיל מהתמונה הזאת"
              file={firstFrame}
              onChange={(file) => {
                setFirstFrame(file);
                if (!file) setLastFrame(null);
              }}
              disabled={working}
            />
            <ImagePicker
              label="תמונת סיום"
              hint={firstFrame ? "הסרטון יסתיים בתמונה הזאת" : "צריך קודם תמונת פתיחה"}
              file={lastFrame}
              onChange={setLastFrame}
              disabled={working || !firstFrame}
            />
          </div>

          <div className="settings">
            <fieldset className="field">
              <legend className="field-label">צורה</legend>
              <div className="segmented">
                {ASPECT_RATIOS.map((option) => (
                  <label key={option.value} className={aspectRatio === option.value ? "active" : ""}>
                    <input
                      type="radio"
                      name="aspectRatio"
                      value={option.value}
                      checked={aspectRatio === option.value}
                      onChange={() => setAspectRatio(option.value)}
                      disabled={working}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span className="field-label">איכות</span>
              <select
                value={resolution}
                onChange={(event) => setResolution(event.target.value as Resolution)}
                disabled={working}
              >
                {RESOLUTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field full">
              <span className="field-label">
                אורך: <strong>{duration} שניות</strong>
              </span>
              <input
                type="range"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                disabled={working}
              />
            </label>
          </div>

          <p className="tip">
            טיפ: Gemini אוהב לחתוך בין כמה שוטים. רוצים שוט אחד? כתבו &quot;בשוט אחד רציף, בלי חיתוכים&quot;.
            רוצים מוזיקה מסוימת? תארו אותה.
          </p>

          <button type="submit" className="primary" disabled={working || !prompt.trim()}>
            {working ? "יוצר…" : "צור סרטון"}
          </button>
        </form>

        <section ref={previewRef} className="panel preview" aria-live="polite">
          <StatusView status={status} />
          {current && !working && (
            <>
              <Player key={current.fileId} entry={current} />
              <p className="caption">{current.prompt}</p>
              <div className="actions">
                <a className="secondary" href={videoUrl(current.fileId, true)} download>
                  הורדת הסרטון
                </a>
              </div>

              <form className="edit" onSubmit={handleEdit}>
                <label className="field">
                  <span className="field-label">רוצים לשנות משהו?</span>
                  <input
                    type="text"
                    value={editPrompt}
                    onChange={(event) => setEditPrompt(event.target.value)}
                    placeholder="לדוגמה: תוסיף כובע לאיש. שאר הסרטון נשאר אותו דבר"
                    maxLength={MAX_PROMPT_LENGTH}
                  />
                </label>
                <div className="chips">
                  {EDIT_SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" className="chip" onClick={() => setEditPrompt(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button type="submit" className="primary" disabled={!editPrompt.trim()}>
                  ערוך את הסרטון
                </button>
              </form>
            </>
          )}
          {!current && status.kind === "idle" && (
            <div className="empty">
              <span aria-hidden>🎬</span>
              <p>הסרטון שלכם יופיע כאן</p>
            </div>
          )}
        </section>
      </main>

      {history.length > 0 && (
        <section className="history">
          <div className="history-header">
            <h2>הסרטונים שלי</h2>
            <p>נשמרים בדפדפן הזה. Google שומרת את הקבצים לזמן מוגבל, אז הורידו את מה שחשוב לכם.</p>
          </div>
          <div className="grid">
            {history.map((entry) => (
              <HistoryCard
                key={entry.interactionId}
                entry={entry}
                selected={entry.interactionId === current?.interactionId}
                onSelect={() => !working && setCurrent(entry)}
                onRemove={() => removeEntry(entry)}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="footer">
        כל סרטון נוצר בחשבון Gemini API שלכם ומחויב לפי אורך הסרטון.
      </footer>
    </div>
  );
}

function StatusView({ status }: { status: Status }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status.kind !== "working") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status.kind]);

  if (status.kind === "working") {
    return (
      <div className="working">
        <div className="spinner" aria-hidden />
        <p className="working-title">{status.label}…</p>
        <p className="working-time">{formatElapsed(Math.max(0, now - status.startedAt))}</p>
        <p className="muted">זה לוקח בדרך כלל דקה או שתיים, ובאיכות 4K יותר. אל תסגרו את הדף.</p>
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div className="error" role="alert">
        {status.message}
      </div>
    );
  }
  return null;
}

function Player({ entry }: { entry: HistoryEntry }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="error" role="alert">
        לא ניתן לטעון את הסרטון. ייתכן ש-Google כבר מחקה אותו (סרטונים נשמרים לזמן מוגבל).
      </div>
    );
  }
  return (
    <video
      className={entry.aspectRatio === "9:16" ? "video portrait" : "video"}
      src={videoUrl(entry.fileId)}
      controls
      autoPlay
      loop
      playsInline
      onError={() => setFailed(true)}
    />
  );
}

function ImagePicker({
  label,
  hint,
  file,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={`picker${disabled ? " disabled" : ""}`}>
      {preview ? (
        <>
          <img src={preview} alt={label} />
          <button type="button" className="remove" onClick={() => onChange(null)} disabled={disabled}>
            הסרה
          </button>
        </>
      ) : (
        <label>
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <span className="picker-label">+ {label}</span>
          <span className="muted">{hint}</span>
        </label>
      )}
    </div>
  );
}

function HistoryCard({
  entry,
  selected,
  onSelect,
  onRemove,
}: {
  entry: HistoryEntry;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const [unavailable, setUnavailable] = useState(false);

  return (
    <article className={`card${selected ? " selected" : ""}`}>
      <button type="button" className="card-media" onClick={onSelect} aria-label={`הצגת הסרטון: ${entry.prompt}`}>
        {unavailable ? (
          <span className="muted">לא ניתן לטעון את הסרטון</span>
        ) : (
          <video src={`${videoUrl(entry.fileId)}#t=0.5`} preload="metadata" muted playsInline onError={() => setUnavailable(true)} />
        )}
      </button>
      <div className="card-body">
        {entry.parentId && <span className="tag">עריכה</span>}
        <p title={entry.prompt}>{entry.prompt}</p>
        <div className="card-footer">
          <time dateTime={new Date(entry.createdAt).toISOString()}>
            {new Date(entry.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
          </time>
          <button type="button" className="link" onClick={onRemove}>
            מחיקה
          </button>
        </div>
      </div>
    </article>
  );
}
