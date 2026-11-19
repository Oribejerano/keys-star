import { buildPrompt } from "@/lib/prompt";
import { mockPost } from "@/lib/mock";
import { complete, resolveMode, type LiveMode } from "@/lib/llm";
import {
  generalizePrivate,
  isTragicContent,
  REFUSAL_MESSAGE,
  sanitizeTopic,
  screenTopic,
} from "@/lib/safety";
import { defangQuotes, ensureMarkers, hasInventedQuote, stripNoise } from "@/lib/text";

export type GenerateSuccess = {
  ok: true;
  text: string;
  mocked: boolean;
  provider: string;
  model: string;
};

export type GenerateFailure = {
  ok: false;
  status: number;
  error: string;
  refused?: boolean;
};

export type GenerateResult = GenerateSuccess | GenerateFailure;

const LIVE_ERROR =
  "המחולל לא ענה. נסו שוב בעוד רגע, או הפעילו MOCK_LLM=1 כדי לראות הדגמה בלי מפתח.";

function finish(text: string): string {
  const marked = ensureMarkers(defangQuotes(stripNoise(text)));
  return hasInventedQuote(marked) ? ensureMarkers(defangQuotes(marked)) : marked;
}

async function writeLive(mode: LiveMode, topic: string, variant: number): Promise<string> {
  const first = buildPrompt(topic, variant, false);
  let text = await complete(mode, first.system, first.user);
  if (hasInventedQuote(text)) {
    const second = buildPrompt(topic, variant, true);
    text = await complete(mode, second.system, second.user);
  }
  return text;
}

export async function generatePost(topicRaw: string, variantRaw: number): Promise<GenerateResult> {
  const topic = generalizePrivate(sanitizeTopic(topicRaw));
  if (topic.length < 2) {
    return { ok: false, status: 400, error: "צריך נושא. גם חומוס נחשב." };
  }
  if (topic.length > 400) {
    return { ok: false, status: 400, error: "הנושא ארוך מדי. עד 400 תווים." };
  }
  const refusal = screenTopic(topicRaw) ?? screenTopic(topic);
  if (refusal) return { ok: false, status: 422, error: refusal, refused: true };

  const variant = Number.isFinite(variantRaw) ? Math.max(0, Math.min(12, Math.floor(variantRaw))) : 0;
  const mode = resolveMode();
  if (mode.kind === "misconfigured") {
    return { ok: false, status: 503, error: mode.message };
  }

  try {
    const raw = mode.kind === "mock" ? mockPost(topic, variant) : await writeLive(mode, topic, variant);
    const text = finish(raw);
    if (isTragicContent(text)) {
      return { ok: false, status: 422, error: REFUSAL_MESSAGE, refused: true };
    }
    return {
      ok: true,
      text,
      mocked: mode.kind === "mock",
      provider: mode.kind === "mock" ? "mock" : mode.provider,
      model: mode.kind === "mock" ? "fewshot-sample" : mode.model,
    };
  } catch (error) {
    console.error("generate failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, status: 502, error: LIVE_ERROR };
  }
}
