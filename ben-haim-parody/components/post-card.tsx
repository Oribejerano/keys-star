"use client";

import { useState } from "react";
import { useDarkMode } from "@/components/use-dark";
import { seededInt } from "@/lib/text";

const FALLBACK_AVATAR =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="#1c1915"/><text x="64" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="46" fill="#f3eee4">אב</text></svg>`,
  );

export const PARODY_LABEL = "🎭 פרודיה · סאטירה";

const LIGHT = {
  card: "#ffffff",
  text: "#0f1419",
  muted: "#536471",
  line: "#eff3f4",
  bar: "#f7f9f9",
  mark: "#6e2430",
};

const DARK = {
  card: "#000000",
  text: "#e7e9ea",
  muted: "#71767b",
  line: "#2f3336",
  bar: "#16181c",
  mark: "#f0b8c0",
};

type PostCardProps = {
  text?: string;
  createdAt?: string;
  pending?: boolean;
  ref?: React.Ref<HTMLElement>;
};

function formatCount(value: number): string {
  if (value < 10_000) return value.toLocaleString("he-IL");
  const thousands = value / 1000;
  const digits = thousands >= 100 ? 0 : 1;
  return `${thousands.toLocaleString("he-IL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} אלף`;
}

function formatStamp(iso?: string): string {
  if (!iso) return "עכשיו";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));
}

function IconReply() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path
        fill="currentColor"
        d="M1.75 12.05C1.75 6.5 6.4 2 12.2 2c5.5 0 9.8 4.2 10.05 9.55.02.4-.3.75-.72.75h-1.5a.75.75 0 0 1-.74-.68A7.3 7.3 0 0 0 12.2 4.5c-4.2 0-7.55 3.3-7.55 7.55 0 1.9.7 3.64 1.86 4.98.28.32.26.8-.08 1.08l-1.1.95a.75.75 0 0 1-1.22-.4A10.7 10.7 0 0 1 1.75 12.05Z"
      />
    </svg>
  );
}

function IconRepost() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path
        fill="currentColor"
        d="M4.5 7.5h11.2l-2.1-2.1 1.4-1.4 4.5 4.5-4.5 4.5-1.4-1.4 2.1-2.1H4.5V17h9v2h-9a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
      />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path
        fill="currentColor"
        d="M12 20.2s-7.2-4.4-7.2-9.2C4.8 8 6.7 6.2 9.2 6.2c1.4 0 2.5.6 2.8 1.6.3-1 1.4-1.6 2.8-1.6 2.5 0 4.4 1.8 4.4 4.8 0 4.8-7.2 9.2-7.2 9.2Z"
      />
    </svg>
  );
}

function IconViews() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path fill="currentColor" d="M3 17h3.2V9H3v8Zm5.4 0H12V5H8.4v12Zm5.2 0h3.4v-6h-3.4v6ZM19 17h2.2V7H19v10Z" />
    </svg>
  );
}

export function PostCard({ text, createdAt, pending = false, ref }: PostCardProps) {
  const [avatar, setAvatar] = useState("/api/avatar");
  const dark = useDarkMode();
  const ink = dark ? DARK : LIGHT;
  const seed = text || "empty";
  const replies = seededInt(seed, 3, 18, 240);
  const reposts = seededInt(seed, 7, 40, 1800);
  const likes = seededInt(seed, 11, 320, 18400);
  const views = seededInt(seed, 19, 12000, 420000);

  return (
    <article
      ref={ref}
      id="post-card"
      dir="rtl"
      aria-label="כרטיס פרודיה"
      className="w-full max-w-[598px] overflow-hidden rounded-2xl border text-right shadow-[0_8px_30px_rgba(28,25,21,0.06)]"
      style={{
        background: ink.card,
        borderColor: ink.line,
        color: ink.text,
        fontFamily: 'var(--font-heebo), Heebo, "Segoe UI", Arial, sans-serif',
      }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2 text-[13px] font-semibold"
        style={{ borderColor: ink.line, background: ink.bar, color: ink.text }}
      >
        <span data-testid="parody-label">{PARODY_LABEL}</span>
        <span className="font-normal" style={{ color: ink.muted }}>
          לא החשבון האמיתי
        </span>
      </div>

      <div className="px-4 pt-3 pb-3">
        <div className="flex gap-3">
          {/* Plain img so the share PNG can draw the same-origin avatar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
            onError={() => setAvatar(FALLBACK_AVATAR)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[15px] leading-5 font-bold">
                אבישי בן חיים <span style={{ color: ink.mark }}>(פרודיה)</span>
              </span>
              <span className="text-[15px] leading-5" style={{ color: ink.muted }}>
                · {formatStamp(createdAt)}
              </span>
            </div>
            <div className="text-[15px] leading-5" dir="ltr" style={{ color: ink.muted }}>
              @BenHaim_Parody
            </div>
          </div>
        </div>

        <div className="mt-3 min-h-16 text-[17px] leading-[1.5] whitespace-pre-wrap">
          {pending ? (
            <div className="space-y-2 py-1" aria-hidden="true">
              <div className="h-4 w-11/12 animate-pulse rounded" style={{ background: ink.line }} />
              <div className="h-4 w-10/12 animate-pulse rounded" style={{ background: ink.line }} />
              <div className="h-4 w-8/12 animate-pulse rounded" style={{ background: ink.line }} />
            </div>
          ) : text ? (
            text
          ) : (
            <p style={{ color: ink.muted }}>
              הפוסט יופיע כאן. הסימון נשאר על הכרטיס, גם בצילום מסך ובקובץ שמשתפים.
            </p>
          )}
        </div>

        {text && !pending ? (
          <div className="mt-3">
            <div
              className="flex max-w-md items-center justify-between text-[13px]"
              style={{ color: ink.muted }}
              aria-hidden="true"
            >
              <span className="inline-flex items-center gap-1.5" title={`תגובות: ${formatCount(replies)}`}>
                <IconReply />
                {formatCount(replies)}
              </span>
              <span className="inline-flex items-center gap-1.5" title={`שיתופים: ${formatCount(reposts)}`}>
                <IconRepost />
                {formatCount(reposts)}
              </span>
              <span className="inline-flex items-center gap-1.5" title={`סימוני אהבתי: ${formatCount(likes)}`}>
                <IconHeart />
                {formatCount(likes)}
              </span>
              <span className="inline-flex items-center gap-1.5" title={`צפיות: ${formatCount(views)}`}>
                <IconViews />
                {formatCount(views)}
              </span>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: ink.muted }}>
              מונים להמחשה · לא נתונים אמיתיים
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
