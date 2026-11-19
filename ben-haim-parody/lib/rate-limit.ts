type Bucket = number[];

const WINDOW_MS = 60_000;
const MAX_HITS = 8;
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_HITS) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    buckets.set(key, recent);
    return { ok: false, retryAfter };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return ip;
}
