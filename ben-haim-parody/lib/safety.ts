export const REFUSAL_MESSAGE =
  "את הנושא הזה הפרודיה לא נוגעת בו: לא שכול, לא חטופים, לא נפגעי שבעה באוקטובר, ולא התקפה על אדם פרטי. נסו משהו יומיומי, למשל הפקק באיילון, החומוס במסעדה, או אסיפת ההורים.";

const TRAGIC = [
  /חטופ/,
  /שכול/,
  /ה?לוו?יה/,
  /ניחום אבלים/,
  /נרצח/,
  /נופלים/,
  /הנופלים/,
  /חללי/,
  /שבעה באוקטובר/,
  /7 באוקטובר/,
  /ז' באוקטובר/,
  /ז׳ באוקטובר/,
  /שבע באוקטובר/,
  /7\.10/,
  /07\.10/,
  /7\/10/,
  /טבח נובה/,
  /מסיבת נובה/,
  /נובה/,
  /ניר עוז/,
  /כפר עזה/,
  /אוקטובר 2023/,
];

const PRIVATE_ROLE =
  /השכנ(?:ה|ים)? שלי|הבוס(?:ית)? שלי|גיסת|הגיס שלי|הקולגה שלי|המורה שלי|אשתי|בעלי|החבר שלי|החברה שלי|אחי|אחותי|אבא שלי|אמא שלי|הילד שלי|הבת שלי|העובד שלי|העובדת שלי|הסטודנט שלי/;

const ATTACK =
  /גנב|מושחת|אנס|בוגד|להכפיש|הכפש|דיבה|לרדוף|מטומט|אידיוט|נוכל|סוטה|רוצח|פדופיל|תתקוף|תשפיל|מניאק|שקרנ|חרא|טיפש|להשפיל/;

const DOX_OR_DEFAME =
  /להכפיש|דיבה על|תעודת זהות|מספר טלפון|לפרסם את הכתובת|הכתובת של|לדוקס|להרוג את|להשמיד את/;

const SLUR = [/כושי/, /ערבוש/, /נאצי של/];

export function normalizeHebrew(input: string): string {
  return input
    .replace(/[ך]/g, "כ")
    .replace(/[ם]/g, "מ")
    .replace(/[ן]/g, "נ")
    .replace(/[ף]/g, "פ")
    .replace(/[ץ]/g, "צ")
    .replace(/["״'«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTragicContent(text: string): boolean {
  const norm = normalizeHebrew(text);
  return TRAGIC.some((pattern) => pattern.test(norm));
}

export function screenTopic(topic: string): string | null {
  const norm = normalizeHebrew(topic);
  if (!norm) return "צריך נושא. גם חומוס נחשב.";
  if (isTragicContent(norm)) return REFUSAL_MESSAGE;
  if (SLUR.some((pattern) => pattern.test(norm))) return REFUSAL_MESSAGE;
  if (DOX_OR_DEFAME.test(norm)) return REFUSAL_MESSAGE;
  if (PRIVATE_ROLE.test(norm) && ATTACK.test(norm)) return REFUSAL_MESSAGE;
  return null;
}

export function sanitizeTopic(topic: string): string {
  return topic
    .replace(/🎭[^\n]*/g, "")
    .replace(/[—–-]\s*סאטירה[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function generalizePrivate(topic: string): string {
  return topic
    .replace(/הבוסית שלי/g, "הבוסית הפריווילגית")
    .replace(/הבוס שלי/g, "הבוס הפריווילג")
    .replace(/השכנה שלי/g, "שכנה מהעשירון העליון")
    .replace(/השכן שלי/g, "שכן מהעשירון העליון")
    .replace(/גיסתי/g, "קרובת משפחה מההגמוניה")
    .replace(/הגיס שלי/g, "קרוב משפחה מההגמוניה")
    .replace(/הקולגה שלי/g, "קולגה מהפריווילגים")
    .replace(/המורה שלי/g, "המורה מההגמוניה")
    .replace(/אשתי/g, "בת זוג")
    .replace(/בעלי/g, "בן זוג")
    .replace(/החברה שלי/g, "מישהי מהשכונה")
    .replace(/החבר שלי/g, "מישהו מהשכונה")
    .replace(/האחות שלי/g, "אחות באופן כללי")
    .replace(/האח שלי/g, "אח באופן כללי")
    .replace(/אחותי/g, "אחות באופן כללי")
    .replace(/אבא שלי/g, "אב מהפריפריה")
    .replace(/אמא שלי/g, "אם מהפריפריה")
    .replace(/הבת שלי/g, "ילדה")
    .replace(/הילד שלי/g, "ילד")
    .replace(/העובדת שלי/g, "עובדת מהמשרד")
    .replace(/העובד שלי/g, "עובד מהמשרד");
}
