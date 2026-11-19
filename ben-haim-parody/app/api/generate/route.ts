import { generatePost } from "@/lib/generate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request));
  if (!limit.ok) {
    return Response.json(
      {
        error: `יותר מדי בקשות ברצף. נסו שוב בעוד ${limit.retryAfter} שניות.`,
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: { topic?: unknown; variant?: unknown };
  try {
    body = (await request.json()) as { topic?: unknown; variant?: unknown };
  } catch {
    return Response.json({ error: "הבקשה לא קריאה." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic : "";
  const variant = typeof body.variant === "number" ? body.variant : Number(body.variant ?? 0);
  const result = await generatePost(topic, variant);
  if (!result.ok) {
    return Response.json(
      { error: result.error, refused: Boolean(result.refused) },
      { status: result.status },
    );
  }

  return Response.json({
    text: result.text,
    mocked: result.mocked,
    provider: result.provider,
    model: result.model,
  });
}
