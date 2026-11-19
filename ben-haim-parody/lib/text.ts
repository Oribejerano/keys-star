export const OPENING = "🎭 פרודיה. לא נכתב על ידי אבישי בן חיים.";
export const CLOSING = "— סאטירה. כל קשר לפוסט אמיתי מקרי בהחלט.";

const QUOTE_AFTER_SPEECH =
  /[\u0590-\u05FF]{2,20}(?:\s+[\u0590-\u05FF]{2,20}){0,3}\s+(?:אמר|אמרה|אומר|אומרת|הצהיר|הצהירה|כתב|כתבה|צייץ|צייצה|טען|טענה)\s*[:：]?\s*["״'«]/;

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clipParagraphs(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const paragraph = cut.lastIndexOf("\n\n");
  if (paragraph > max * 0.45) return `${cut.slice(0, paragraph).trim()}\n…`;
  const line = cut.lastIndexOf("\n");
  if (line > max * 0.6) return `${cut.slice(0, line).trim()}\n…`;
  return `${cut.trim()}…`;
}

export function hasInventedQuote(text: string): boolean {
  return QUOTE_AFTER_SPEECH.test(text);
}

export function defangQuotes(text: string): string {
  return text.replace(
    /((?:אמר|אמרה|אומר|אומרת|הצהיר|הצהירה|כתב|כתבה|צייץ|צייצה|טען|טענה)\s*[:：]?\s*)["״'«][^"״»'\n]{0,240}["״»']/g,
    "$1שזה, בעצם, הגמוניה",
  );
}

export function stripNoise(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/@AvishayBenHaim/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMarkerLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("🎭") ||
    trimmed.startsWith("— סאטירה") ||
    trimmed.startsWith("- סאטירה") ||
    trimmed.startsWith("– סאטירה")
  );
}

export function ensureMarkers(raw: string): string {
  const cleaned = stripNoise(raw).replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
  const body = cleaned
    .split("\n")
    .filter((line) => !isMarkerLine(line))
    .join("\n")
    .trim();
  return `${OPENING}\n\n${body}\n\n${CLOSING}`;
}

export function seededInt(seed: string, salt: number, min: number, max: number): number {
  const x = Math.imul(hashString(seed) ^ salt, 2246822519) >>> 0;
  return min + (x % (max - min + 1));
}
