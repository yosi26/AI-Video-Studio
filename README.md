# AI-Video-Studio
AI video generator - create cinematic videos from text and images

## סרטון פרסומי לעסק בחינם (30 שניות, 9:16)

הסרטון נבנה מאנימציית HTML ומומר ל-MP4 מקומית, בלי שירותים בתשלום.

1. ערכו את `business.json`: שם העסק, משפט פתיחה (מילים בתוך `*כוכביות*` יודגשו בצבע), שלושה שירותים, מבצע, פרטי קשר וצבעים.
   אפשר גם להוסיף `logo` (נתיב לקובץ PNG/SVG), `images` (תמונות רקע) ו-`music` (קובץ MP3 ללא זכויות יוצרים).
2. התקנה חד-פעמית: `npm install` ו-`pip install imageio-ffmpeg` (או ffmpeg מותקן במערכת).
3. יצירה: `npm run render`. הקובץ נשמר ב-`output/promo.mp4`.
   תצוגה מהירה של פריימים בודדים: `PREVIEW=2,7,12 npm run render`.

הגופן Heebo מופץ תחת רישיון SIL OFL (`assets/fonts/OFL-LICENSE.txt`).
