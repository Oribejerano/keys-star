import { connection } from "next/server";

const UPSTREAM = "https://unavatar.io/x/AvishayBenHaim";
const FALLBACK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="64" fill="#1c1915"/>
  <text x="64" y="78" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" fill="#f3eee4">אב</text>
</svg>`;

let memory: { at: number; body: Uint8Array; type: string } | null = null;

function fallback() {
  return new Response(FALLBACK_SVG, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET() {
  await connection();
  if (memory && Date.now() - memory.at < 12 * 60 * 60 * 1000) {
    return new Response(Buffer.from(memory.body), {
      headers: {
        "Content-Type": memory.type,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "yisrael-hashniya-parody/0.1" },
    });
    const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!upstream.ok || !type.startsWith("image/")) return fallback();
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength < 80 || bytes.byteLength > 2_000_000) return fallback();
    memory = { at: Date.now(), body: bytes, type };
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return fallback();
  }
}
