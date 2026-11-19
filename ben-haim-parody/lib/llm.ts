import Anthropic from "@anthropic-ai/sdk";

export type LiveMode = {
  kind: "live";
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
};

export type ResolvedMode =
  | { kind: "mock" }
  | LiveMode
  | { kind: "misconfigured"; message: string };

function matchesProvider(provider: "openai" | "anthropic", model: string): boolean {
  if (provider === "openai") return /^(gpt-|o\d|chatgpt)/i.test(model);
  return /^claude/i.test(model);
}

function modelFor(provider: "openai" | "anthropic"): string {
  const shared = process.env.LLM_MODEL?.trim() ?? "";
  if (provider === "openai") {
    return (
      process.env.OPENAI_MODEL?.trim() ||
      (shared && matchesProvider("openai", shared) ? shared : "") ||
      "gpt-4o-mini"
    );
  }
  return (
    process.env.ANTHROPIC_MODEL?.trim() ||
    (shared && matchesProvider("anthropic", shared) ? shared : "") ||
    "claude-opus-5-5"
  );
}

export function resolveMode(): ResolvedMode {
  const flag = (process.env.MOCK_LLM ?? "").trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return { kind: "mock" };

  const requested = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const forceLive = flag === "0" || flag === "false" || flag === "no";

  let provider: "openai" | "anthropic" | null = null;
  if (requested === "openai" || requested === "anthropic") provider = requested;
  else if (openaiKey && !anthropicKey) provider = "openai";
  else if (anthropicKey && !openaiKey) provider = "anthropic";
  else if (openaiKey && anthropicKey) provider = "openai";

  if (!provider) {
    if (forceLive || requested) {
      return {
        kind: "misconfigured",
        message:
          "לא הוגדר מפתח למודל. הוסיפו OPENAI_API_KEY או ANTHROPIC_API_KEY, או הפעילו MOCK_LLM=1 להדגמה.",
      };
    }
    return { kind: "mock" };
  }

  const apiKey = provider === "openai" ? openaiKey : anthropicKey;
  if (!apiKey) {
    return {
      kind: "misconfigured",
      message:
        provider === "openai"
          ? "LLM_PROVIDER=openai אבל חסר OPENAI_API_KEY."
          : "LLM_PROVIDER=anthropic אבל חסר ANTHROPIC_API_KEY.",
    };
  }

  return { kind: "live", provider, model: modelFor(provider), apiKey };
}

export async function complete(mode: LiveMode, system: string, user: string): Promise<string> {
  if (mode.provider === "openai") return completeOpenAI(mode, system, user);
  return completeAnthropic(mode, system, user);
}

async function completeOpenAI(mode: LiveMode, system: string, user: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mode.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: mode.model,
      temperature: 0.95,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`openai ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("openai empty");
  return text;
}

let anthropicClient: Anthropic | null = null;

function anthropicFor(apiKey: string): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
  }
  return anthropicClient;
}

async function completeAnthropic(mode: LiveMode, system: string, user: string): Promise<string> {
  const client = anthropicFor(mode.apiKey);
  let response;
  try {
    response = await client.beta.messages.create({
      model: mode.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      // The system prompt (draft + style guide) is identical on every request.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new Error("anthropic 429");
    if (error instanceof Anthropic.AuthenticationError) throw new Error("anthropic 401");
    if (error instanceof Anthropic.APIError) throw new Error(`anthropic ${error.status ?? "?"}`);
    throw error;
  }
  if (response.stop_reason === "refusal") throw new Error("anthropic refusal");
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  if (!text) throw new Error("anthropic empty");
  return text;
}
