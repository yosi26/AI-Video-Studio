# AI-Video-Studio
AI video generator - create cinematic videos from text and images

סטודיו וידאו בדפדפן: הופך תמונות לסרטון קולנועי עם תנועת מצלמה, כותרות בעברית ומוזיקה. בנוסף יש בו מתכנן לעבודה עם מודלי AI.

## מה יש בפנים

### 🎬 סטודיו חינמי
רץ כולו בדפדפן, בלי מודלים, בלי קרדיטים ובלי שרת.

- **תמונות לסצנות:** כל תמונה מקבלת תנועת מצלמה (זום פנימה או החוצה, תנועה ימינה או שמאלה).
- **כרטיסי כותרת** וכתוביות בעברית, עם אנימציית כניסה.
- **מראה:** קולנועי (teal & orange), חמים, שחור-לבן או וינטג'. אפשר להוסיף גרעיניות פילם ופסים שחורים של 2.39:1.
- **מעברי crossfade** בין סצנות, ו-fade מהשחור ואל השחור.
- **פסקול:** מוזיקה שנוצרת בקוד (Web Audio). פד אקורדים, בס, דופק וריזר בסוף.
- **יחסי מסך:** 16:9 ליוטיוב, 9:16 לרילס וטיקטוק, 1:1 לפיד.
- **ייצוא** ל-MP4 ב-Chrome ו-Edge, ול-WebM בדפדפנים אחרים.

### ✨ מתכנן AI
- **קטלוג מודלים** של BudgetPixel (תמונה, וידאו, מוזיקה ואפקטים) עם מחירים.
- **מחשבון עלות:** לפי רזולוציה, אורך וכמות, מול היתרה שלך.
- **בונה פרומפטים:** מי, איפה, מה קורה, מצלמה, תאורה וסגנון. התוצאה היא פרומפט באנגלית, מוכן להעתקה.

## הרצה

```bash
npm install
npm run dev      # שרת פיתוח
npm run build    # בנייה ל-dist/
npm run lint
```

## מבנה

```
src/
  engine/render.ts   ציור פריים לפי זמן: סצנות, תנועה, מעברים, פילטרים, טקסט
  engine/music.ts    פסקול פרוצדורלי ב-Web Audio
  engine/export.ts   הקלטת הקנבס והאודיו ל-MP4/WebM עם MediaRecorder
  components/        Studio (עורך) ו-Planner (מתכנן AI)
  models.ts          קטלוג המודלים והמחירים
```

הייצוא מוקלט בזמן אמת, כך שסרטון של 15 שניות לוקח 15 שניות. הלשונית צריכה להישאר פתוחה ומוצגת בזמן הייצוא.

## Higgsfield API (Seedance 2.5)

`index.ts` is a server-side example that generates a video with `bytedance/seedance-2.5/text-to-video`
through the official SDK (`@higgsfield/client/v2`, method `subscribe`).

1. Create a key in the Higgsfield console.
2. Put it in `.env.local`, which is ignored by Git and never committed:
   ```
   HF_CREDENTIALS=key-id:key-secret
   ```
3. Run it (this is a billable generation):
   ```bash
   npm run generate
   ```

The script waits up to 20 minutes and prints the video URL. If the request fails, is rejected by
moderation, or is canceled, it exits with code 1 and never reports success.
The key stays on the server: the SDK blocks browser use, and the Vite app never reads it.
