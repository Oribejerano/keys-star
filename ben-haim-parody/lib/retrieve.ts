import fs from "node:fs";
import path from "node:path";
import { hashString } from "@/lib/text";
import { isTragicContent, normalizeHebrew } from "@/lib/safety";

type Doc = {
  text: string;
  forms: Set<string>;
  likes: number;
};

const STOP = new Set(
  "של את על עם לא זה זו גם כי אם או יש אין מה מי כל יותר אבל רק עוד בין אני אתה כדי אל כן אז כך ככה היום מאוד מאד הוא היא הם הן אתם אנחנו לי לו לה היה הייתה להיות מן עד אחרי לפני בלי כמו אולי פה שם כבר ועוד אתכם אותם אותן הזה הזאת".split(
    " ",
  ),
);

let index: Doc[] | null = null;

function formsOf(word: string): string[] {
  const found = new Set<string>();
  const add = (value: string) => {
    if (value.length >= 2 && !STOP.has(value)) found.add(value);
  };
  add(word);
  let current = word;
  if (current.startsWith("ו") && current.length > 3) {
    current = current.slice(1);
    add(current);
  }
  if (current.startsWith("ה") && current.length > 3) add(current.slice(1));
  if (current.startsWith("ה") && current.length > 4) add(current.slice(2));
  return [...found];
}

function tokenize(input: string): string[] {
  const norm = normalizeHebrew(input.toLowerCase());
  const words = norm.split(/[^\u0590-\u05ffa-z0-9]+/).filter(Boolean);
  const forms = new Set<string>();
  for (const word of words) {
    for (const form of formsOf(word)) forms.add(form);
  }
  return [...forms];
}

function loadIndex(): Doc[] {
  if (index) return index;
  const raw = fs.readFileSync(path.join(process.cwd(), "data/corpus.jsonl"), "utf8");
  const docs: Doc[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let parsed: { text?: string; likes?: number | null };
    try {
      parsed = JSON.parse(line) as { text?: string; likes?: number | null };
    } catch {
      continue;
    }
    const text = (parsed.text ?? "").replace(/https?:\/\/\S+/g, "").trim();
    if (text.length < 80 || text.length > 900) continue;
    if (isTragicContent(text)) continue;
    const forms = new Set(tokenize(text));
    if (forms.size < 4) continue;
    docs.push({ text, forms, likes: typeof parsed.likes === "number" ? parsed.likes : 0 });
  }
  index = docs;
  return docs;
}

export function retrieveExamples(topic: string, limit = 3): string[] {
  const docs = loadIndex();
  const query = new Set(tokenize(topic));
  const ranked = docs
    .map((doc) => {
      let hits = 0;
      for (const term of query) {
        if (doc.forms.has(term)) hits += 1;
      }
      if (hits === 0) return null;
      const score = hits / Math.sqrt(doc.forms.size) + Math.log10(doc.likes + 1) * 0.04;
      return { doc, score, hits };
    })
    .filter((row): row is { doc: Doc; score: number; hits: number } => row !== null)
    .sort((a, b) => b.score - a.score || b.hits - a.hits);

  const picked: string[] = [];
  for (const row of ranked) {
    if (picked.length >= limit) break;
    if (picked.some((existing) => existing.slice(0, 80) === row.doc.text.slice(0, 80))) continue;
    picked.push(row.doc.text);
  }

  if (picked.length >= 2) return picked;

  const hegemony = docs.filter((doc) => doc.text.includes("הגמוניה") || doc.text.includes("ישראל השנייה"));
  const pool = hegemony.length ? hegemony : docs;
  let cursor = hashString(topic) % Math.max(pool.length, 1);
  while (picked.length < Math.min(2, pool.length) && pool.length) {
    const doc = pool[cursor % pool.length];
    cursor += 1;
    if (picked.includes(doc.text)) {
      if (cursor > pool.length + picked.length) break;
      continue;
    }
    picked.push(doc.text);
  }
  return picked.slice(0, limit);
}
