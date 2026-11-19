import fs from "node:fs";
import path from "node:path";
import { hashString } from "@/lib/text";
import { isTragicContent } from "@/lib/safety";

export type StyleExample = {
  id: number;
  group: string;
  text: string;
};

let cached: StyleExample[] | null = null;

export function loadFewshot(): StyleExample[] {
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(process.cwd(), "data/fewshot.md"), "utf8");
  const parts = raw.split(/\n(?=## )/);
  const examples: StyleExample[] = [];
  for (const part of parts) {
    const heading = part.match(/^##\s+([א-ת])/);
    if (!heading) continue;
    const group = heading[1];
    const re = /###\s+(\d+)\.\s+[^\n]+\n```\n([\s\S]*?)\n```/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(part))) {
      const text = match[2].trim();
      if (!text || isTragicContent(text)) continue;
      examples.push({ id: Number(match[1]), group, text });
    }
  }
  cached = examples;
  return examples;
}

function preferredGroups(topic: string): string[] {
  if (/שבת|חג|פסח|שנה טובה|כיפור|חנוכה|פורים|סוכות|שבועות|ברכה/.test(topic)) {
    return ["ה", "י", "א"];
  }
  if (/מכתב|היקר|היקרה/.test(topic)) return ["ו", "ה", "א"];
  if (/מניפסט|רשימה|מה ללמוד|חייבים ללמוד/.test(topic)) return ["ג", "א", "ז"];
  if (/נתניהו|ביבי|בגין|בחירות|בג"ץ|בג״ץ|כנסת|הגמוניה|ליכוד/.test(topic)) {
    return ["ב", "ד", "א"];
  }
  return ["א", "ז", "ב", "ה"];
}

export function selectFewshot(topic: string, variant: number): StyleExample[] {
  const all = loadFewshot();
  const byGroup = new Map<string, StyleExample[]>();
  for (const example of all) {
    const list = byGroup.get(example.group) ?? [];
    list.push(example);
    byGroup.set(example.group, list);
  }

  const picked: StyleExample[] = [];
  const seen = new Set<number>();
  const take = (group: string, shift: number) => {
    const pool = byGroup.get(group);
    if (!pool?.length) return;
    const choice = pool[(hashString(topic) + variant + shift) % pool.length];
    if (seen.has(choice.id)) return;
    seen.add(choice.id);
    picked.push(choice);
  };

  preferredGroups(topic).forEach((group, index) => take(group, index));

  const rest = all.filter((example) => !seen.has(example.id));
  let cursor = 0;
  while (picked.length < 4 && cursor < rest.length) {
    const choice = rest[(hashString(`${topic}:${variant}`) + cursor) % rest.length];
    cursor += 1;
    if (seen.has(choice.id)) continue;
    seen.add(choice.id);
    picked.push(choice);
  }
  return picked.slice(0, 4);
}
