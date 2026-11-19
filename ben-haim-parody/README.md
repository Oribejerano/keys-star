# מחולל ישראל השנייה

פרודיה מסומנת בעברית, בסגנון הטיקים של ד"ר אבישי בן חיים. מקלידים נושא, גם יומיומי, ומקבלים פוסט אחד על כרטיס שנראה כמו פוסט ב-X.

הסימון תפור לכרטיס ואין דרך להסיר אותו: השם הוא **אבישי בן חיים (פרודיה)**, הידית היא **@BenHaim_Parody** (לא החשבון האמיתי), ועל הכרטיס כתוב **🎭 פרודיה · סאטירה**. שתי שורות הסימון נשארות גם בטקסט עצמו. כפתור השיתוף מצלם את הכרטיס כולו, כולל הסימון.

הכלי מסרב לנושאים של שכול, חטופים, נפגעי שבעה באוקטובר, ולהתקפה על אדם פרטי.

## הרצה מקומית

```bash
npm install
cp .env.example .env.local
npm run dev
```

השרת עולה על [http://127.0.0.1:43123](http://127.0.0.1:43123).

בלי מפתח API האפליקציה נכנסת למצב הדגמה ומחזירה פוסט מקומי באותו קול. כדי לכפות את זה:

```bash
MOCK_LLM=1 npm run dev
```

בדיקה מהירה בלי דפדפן:

```bash
npm run check
```

## משתני סביבה

| משתנה | תפקיד |
| --- | --- |
| `LLM_PROVIDER` | `openai` או `anthropic`. אם ריק, נבחר ספק שיש לו מפתח. |
| `OPENAI_API_KEY` | מפתח OpenAI. נשאר בשרת. |
| `OPENAI_MODEL` | ברירת מחדל `gpt-4o-mini`. |
| `ANTHROPIC_API_KEY` | מפתח Anthropic. נשאר בשרת. |
| `ANTHROPIC_MODEL` | ברירת מחדל `claude-opus-5-5`. |
| `LLM_MODEL` | דריסה אופציונלית, רק אם השם מתאים לספק הפעיל. |
| `MOCK_LLM` | `1` תמיד הדגמה. `0` אף פעם לא הדגמה. ריק: הדגמה רק כשאין מפתח. |

המפתחות לא נשלחים לדפדפן. יש הגבלת קצב בסיסית: 8 בקשות לדקה לכתובת. ב-Vercel המונה יושב בזיכרון של כל מופע, לא במסד משותף.

הפרומפט מרכיב את טיוטת המערכת, מדריך הסגנון, 4 דוגמאות מגוונות מ-`data/fewshot.md`, ועד 3 קטעים מ-`data/corpus.jsonl` לפי חפיפת מילים עם הנושא. הקורפוס לא מוצג בממשק.

## פריסה ב-Vercel

1. דחפו את הריפו וחברו אותו לפרויקט ב-Vercel.
2. תחת Settings → Environment Variables הגדירו `LLM_PROVIDER` ומפתח אחד לפחות, או `MOCK_LLM=1` לתצוגה בלי מודל.
3. Deploy. Next.js מזהה את הפרויקט לבד. אין צורך בפקודת בנייה מותאמת (`npm run build`).
4. הקבצים ב-`data/` נארזים עם הפונקציה של `/api/generate`.

---

# Second Israel generator

A marked Hebrew parody in the rhetorical tics of Dr. Avishai Ben-Haim. Type a topic, including a mundane one, and get a single post on a card that looks like an X post.

The parody mark is part of the card and cannot be turned off: the name is **אבישי בן חיים (פרודיה)**, the handle is **@BenHaim_Parody** (not the real account), and the card shows **🎭 פרודיה · סאטירה**. The same two disclaimer lines stay inside the post text. Share captures the whole card, marks included, as a PNG (Web Share API when the browser can share files, otherwise a download plus copied text).

The generator refuses bereavement, hostages, October 7 victims, and attacks on private individuals.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

With no API key it falls back to mock mode and returns a local post in the same voice. Force that with `MOCK_LLM=1 npm run dev`. `npm run check` runs the safety and mock checks without a browser.

## Environment

| Variable | Role |
| --- | --- |
| `LLM_PROVIDER` | `openai` or `anthropic`. Empty: use whichever key is set. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Server-only. Never sent to the browser. |
| `OPENAI_MODEL` | Default `gpt-4o-mini`. |
| `ANTHROPIC_MODEL` | Default `claude-opus-5-5`. |
| `LLM_MODEL` | Optional override, only if the name matches the active provider. |
| `MOCK_LLM` | `1` always mock. `0` never mock. Unset: mock only when no key is present. |

Basic rate limit: 8 requests per minute per IP, in memory. On Vercel that counter is per instance.

Each request builds a prompt from the system draft, the style guide, four varied examples from `data/fewshot.md`, and up to three keyword matches from `data/corpus.jsonl`. The corpus is not shown in the UI.

## Deploy on Vercel

1. Push the repo and import it as a Vercel project.
2. In Settings → Environment Variables set `LLM_PROVIDER` and one API key, or `MOCK_LLM=1` for a keyless preview.
3. Deploy. Next.js is detected automatically (`npm run build`).
4. Files under `data/` are traced into the `/api/generate` function.
