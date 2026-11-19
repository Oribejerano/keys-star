"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PostCard } from "@/components/post-card";

const SUGGESTIONS = [
  "הפקק באיילון",
  "החומוס נגמר",
  "אסיפת הורים",
  "גמר ה-NBA",
  "המזגן במשרד",
  "תור בקופת חולים",
];

type ApiOk = {
  text: string;
  mocked: boolean;
  provider: string;
  model: string;
};

type ApiErr = {
  error?: string;
  refused?: boolean;
};

export function Generator() {
  const cardRef = useRef<HTMLElement>(null);
  const [topic, setTopic] = useState("");
  const [variant, setVariant] = useState(0);
  const [text, setText] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [meta, setMeta] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function generate(nextVariant: number) {
    const clean = topic.trim();
    if (clean.length < 2) {
      setError("קודם נושא. גם חומוס נחשב.");
      setRefused(false);
      return;
    }
    setPending(true);
    setError(null);
    setRefused(false);
    setShareNote(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: clean, variant: nextVariant }),
      });
      const data = (await response.json()) as ApiOk & ApiErr;
      if (!response.ok || !data.text) {
        if (data.refused) {
          setText(null);
          setMeta(null);
          setRefused(true);
        }
        setError(data.error || "משהו השתבש. נסו שוב.");
        return;
      }
      setText(data.text);
      setCreatedAt(new Date().toISOString());
      setVariant(nextVariant);
      setMeta(
        data.mocked
          ? "נוצר במצב הדגמה, בלי מודל. עם מפתח API מתקבל פוסט חדש על אותו כרטיס."
          : `נוצר עם ${data.provider} · ${data.model}`,
      );
    } catch {
      setError("אין קשר לשרת. בדקו שהאפליקציה רצה ונסו שוב.");
    } finally {
      setPending(false);
    }
  }

  async function share() {
    if (!cardRef.current || !text) return;
    setSharing(true);
    setShareNote(null);
    try {
      const dark = document.documentElement.classList.contains("dark");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: dark ? "#000000" : "#ffffff",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "parody-ben-haim.png", { type: "image/png" });
      const payload = { files: [file], title: "פרודיה · אבישי בן חיים", text };
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share(payload);
        setShareNote("הכרטיס שותף, כולל סימון הפרודיה.");
      } else {
        download(dataUrl);
        await copyText(text);
        setShareNote("הדפדפן לא משתף תמונה. הקובץ ירד, והטקסט הועתק.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareNote("השיתוף נעצר. נסו שוב.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <form
        className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void generate(0);
        }}
      >
        <label htmlFor="topic" className="text-sm font-medium">
          הנושא
        </label>
        <Textarea
          id="topic"
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="למשל: הפקק באיילון, אסיפת הורים, גמר ה-NBA, המזגן במשרד"
          maxLength={400}
          className="min-h-32 text-base md:text-base"
          aria-invalid={Boolean(error)}
          disabled={pending}
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => setTopic(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" size="lg" className="h-11 px-4 text-base sm:min-w-36" disabled={pending}>
            {pending ? "כותב…" : "צור פוסט"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 px-4 text-base"
            disabled={pending || !text}
            onClick={() => void generate(variant + 1)}
          >
            עוד גרסה
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-11 px-4 text-base"
            disabled={pending || sharing || !text}
            onClick={() => void share()}
          >
            {sharing ? "מכין תמונה…" : "שתף"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">עד 400 תווים. הסימון על הכרטיס קבוע, בלי אפשרות להסיר אותו.</p>
        {shareNote ? <p className="text-sm">{shareNote}</p> : null}
      </form>

      <div aria-live="polite" className="flex flex-col items-center gap-3">
        {error ? (
          <p
            className={`w-full max-w-[598px] rounded-xl border px-4 py-3 text-sm ${
              refused
                ? "border-amber-700/30 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {error}
          </p>
        ) : null}
        <PostCard ref={cardRef} text={pending ? undefined : (text ?? undefined)} createdAt={createdAt} pending={pending} />
        {meta ? <p className="max-w-[598px] text-sm text-muted-foreground">{meta}</p> : null}
      </div>
    </div>
  );
}

function download(dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "parody-ben-haim.png";
  link.click();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
