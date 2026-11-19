# Handoff

Hebrew RTL parody generator for posts in the rhetorical style of Dr. Avishai Ben-Haim. Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui (base-nova). The running demo uses mock mode and does not call a model.

## Architecture

Browser UI (`components/generator.tsx`) posts `{ topic, variant }` to `POST /api/generate`. The route rate-limits by IP (8 requests / 60s, in memory), then `lib/generate.ts`:

1. Sanitizes the topic and rewrites private roles ("הבוס שלי") into generic types.
2. Refuses bereavement, hostages, October 7, slurs, doxxing, and attacks on private people (`lib/safety.ts`). Returns 422 with a gentle Hebrew message.
3. Resolves the model (`lib/llm.ts`). `MOCK_LLM=1`, or no key and mock not forced off, uses `lib/mock.ts` (six local templates). Otherwise OpenAI Chat Completions or Anthropic Messages.
4. Live calls build a system prompt from `data/system_prompt.md` (fenced draft only; implementation notes stay out) plus the style guide from section 1, four varied few-shot posts (`lib/fewshot.ts`, tragic examples dropped), and up to three keyword matches from `data/corpus.jsonl` (`lib/retrieve.ts`). One retry if the draft puts a quote in a real person's mouth.
5. `lib/text.ts` forces the opening and closing parody lines back on, strips URLs and `@AvishayBenHaim`, and defangs quoted speech.

The card (`components/post-card.tsx`) is what gets shared. Marks are hardcoded, not props: display name "אבישי בן חיים (פרודיה)", handle `@BenHaim_Parody`, label "🎭 פרודיה · סאטירה". Share uses `html-to-image` `toPng` on that node, then `navigator.share` with the PNG when the browser allows files, otherwise download plus copy. Colors are inline hex so the PNG does not depend on ancestor CSS variables. Avatar is `GET /api/avatar`, which proxies `https://unavatar.io/x/AvishayBenHaim` and falls back to an initials SVG. A plain `<img>` is intentional: `next/image` breaks the capture.

Light/dark is a `dark` class on `<html>`, set before paint by the inline script in `lib/theme-boot.ts`. `components/use-dark.ts` reads it with `useSyncExternalStore`.

## File map

| Path | Role |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Hebrew RTL page, Heebo + Frank Ruhl Libre, DirectionProvider |
| `app/globals.css` | Tailwind 4 + shadcn tokens, paper/wine palette |
| `components/generator.tsx` | Topic form, suggestions, generate / regenerate / share |
| `components/post-card.tsx` | X-style card and fixed parody chrome |
| `components/theme-toggle.tsx` | Light/dark button |
| `components/ui/*` | shadcn Button, Textarea, Direction |
| `app/api/generate/route.ts` | JSON API |
| `app/api/avatar/route.ts` | Profile image proxy |
| `lib/generate.ts` | Orchestration |
| `lib/llm.ts` | Provider selection and HTTP calls |
| `lib/prompt.ts` | System + user prompt |
| `lib/mock.ts` | Offline samples |
| `lib/safety.ts` | Refusals and private-role rewrite |
| `lib/fewshot.ts` | Parses `data/fewshot.md` (29 examples after the October 7 filter) |
| `lib/retrieve.ts` | Keyword retrieval over the corpus |
| `lib/text.ts` | Markers, quote cleanup, seeded counters |
| `lib/rate-limit.ts` | Per-IP window |
| `data/system_prompt.md` | Draft system prompt. Keep its safety rules. |
| `data/style_guide.md` | Phrase frequencies and the rhetorical machine |
| `data/fewshot.md` | 30 real posts, style only. Do not copy full sentences into new posts. |
| `data/corpus.jsonl` | 794 posts. Server-side retrieval only; never rendered as real posts. |
| `scripts/self-check.ts` | `npm run check` |
| `.env.example`, `README.md` | Env vars and Vercel notes, Hebrew and English |

`next.config.ts` traces `./data/**` into the generate route. `export const runtime` is incompatible with `cacheComponents` in this Next version; do not add it back.

## Env vars

See `.env.example`. No secrets are committed.

| Name | Meaning |
| --- | --- |
| `LLM_PROVIDER` | `openai` or `anthropic`. Empty: whichever key exists; both keys defaults to OpenAI. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Server only. |
| `OPENAI_MODEL` | Default `gpt-4o-mini`. |
| `ANTHROPIC_MODEL` | Default `claude-opus-5-5`. |
| `LLM_MODEL` | Override only when the name matches the active provider (`gpt-*` / `o*` or `claude*`). |
| `MOCK_LLM` | `1` always mock. `0` never mock (503 if the key is missing). Unset: mock only when no key is set. |

Rate limit state is process memory. On Vercel it is per instance.

## What's done

- Hebrew RTL UI, mobile layout, light and dark card.
- Fixed in-card parody marks and the two lines inside the generated text.
- Share-as-PNG with Web Share, download, and clipboard fallback.
- OpenAI and Anthropic path, key never sent to the client.
- Mock mode, safety refusals, few-shot selection, keyword retrieval.
- `npm run build` and `npm run check` pass. Local demo: `MOCK_LLM=1 npm start` on port 43123.

## Suggested next steps

- The live model path is implemented and untested here (no API key). Hit `/api/generate` once with a real key and read the post for copied sentences, invented quotes, and missing markers.
- Replace the in-memory rate limit if this is public (Redis or Vercel KV). The quick tunnel has no auth.
- Retrieval is lexical. Embeddings would help mundane topics that share no words with the corpus.
- Mock templates are original, not excerpts. If the voice is thin, add more variants in `lib/mock.ts` rather than pasting corpus lines.
- `html-to-image` can fail on some mobile browsers. If share errors, fall back is already there; a server-side PNG is the robust version.
- Avatar proxy has no persistent cache across instances. Fine for a demo.
- Do not add a control that hides "(פרודיה)", `@BenHaim_Parody`, or "🎭 פרודיה · סאטירה".

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Dev server port is 43123. `npm run check` needs no browser.
