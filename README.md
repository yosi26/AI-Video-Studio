# AI-Video-Studio

AI video generator - create cinematic videos from text and images, powered by Google's
**Gemini Omni Flash** (`gemini-omni-1.1-flash`).

<div dir="rtl">

## מה זה עושה

אפליקציית אינטרנט בעברית ליצירת סרטונים עם הבינה המלאכותית החדשה של Google, Gemini Omni Flash:

- **סרטון מטקסט:** כותבים מה רוצים לראות ומקבלים סרטון עם סאונד.
- **סרטון מתמונה:** מעלים תמונת פתיחה, ואם רוצים גם תמונת סיום. הסרטון מתחיל מהתמונה (ומסתיים בתמונה השנייה).
- **עריכה בשיחה:** אחרי שהסרטון מוכן כותבים מה לשנות, למשל "הפוך לאנימה" או "המשך את הסרטון", ו-Gemini עורך את אותו סרטון.
- **הגדרות:** לרוחב (16:9) או לאורך (9:16), איכות מ-360p ועד 4K, ואורך של 3 עד 10 שניות.
- **היסטוריה:** הסרטונים שיצרתם נשמרים ברשימה בדפדפן, עם כפתור הורדה.

## מה צריך

1. **Node.js** בגרסה 22.19 ומעלה. מורידים מ-<https://nodejs.org> (גרסת LTS).
2. **מפתח Gemini API.** יוצרים אותו ב-<https://aistudio.google.com/apikey>.
   יצירת וידאו עולה כסף לפי אורך הסרטון, ולכן ייתכן שתצטרכו להפעיל חיוב (billing) בחשבון. את המחירים העדכניים בודקים בדף התמחור של Gemini API.

## הפעלה במחשב

פותחים חלון טרמינל (ב-Windows: PowerShell) ומריצים:

```bash
git clone https://github.com/yosi26/AI-Video-Studio.git
cd AI-Video-Studio
npm install
```

אחר כך יוצרים קובץ בשם `.env.local` בתיקייה הראשית של הפרויקט (אפשר להעתיק את `.env.example`), ומדביקים בו את המפתח:

```
GEMINI_API_KEY=המפתח-שלכם
```

ומפעילים:

```bash
npm run dev
```

פותחים בדפדפן את <http://localhost:3000>, וזהו.

## טיפים לתיאור טוב (מהמדריך של Google)

- Gemini אוהב לחתוך בין כמה שוטים. רוצים שוט אחד? כתבו "בשוט אחד רציף, בלי חיתוכים".
- רוצים מוזיקה או סאונד מסוים? תארו אותם, למשל "מוזיקה רגועה ברקע" או "בלי דיאלוג".
- אפשר לתזמן אירועים: "אחרי 3 שניות אישה נכנסת לפריים".
- בעריכה, הוראה קצרה עובדת הכי טוב. כדאי להוסיף "שאר הסרטון נשאר אותו דבר".

## חשוב לדעת

- **המפתח שלכם נשאר בשרת.** הדפדפן אף פעם לא רואה אותו.
- **Google שומרת את הסרטונים לזמן מוגבל בלבד.** הורידו את מה שחשוב לכם.
- **הרשימה "הסרטונים שלי" נשמרת רק בדפדפן הזה.**
- **סרטון לוקח בדרך כלל דקה או שתיים, ו-4K לוקח יותר.** לא סוגרים את הדף בזמן היצירה.

</div>

## Technical notes

- Next.js 16 (App Router) + React 19 + TypeScript. No database: history lives in `localStorage`.
- `src/lib/gemini.ts` calls the Interactions API through `@google/genai`
  (`ai.interactions.create` with `response_format: { type: "video", delivery: "uri", aspect_ratio, resolution, duration }`).
  Start/end frames are uploaded with the Files API and tagged `<FIRST_FRAME>` / `<LAST_FRAME>` in the prompt.
  Edits and extensions pass `previous_interaction_id`.
- `POST /api/generate` validates the form and waits for the video (generation is synchronous; the global
  fetch timeouts are raised to 15 minutes because Node's default of 5 minutes is too short for 4K).
- `GET /api/video/[fileId]` streams the generated file from the Files API (with Range support), so the API key
  never reaches the browser.
- `npm run typecheck` and `npm run build` are the checks.
