type CacheEntry = { rate: number; fetchedAt: number };

// Module-level cache — survives across requests in the same Node.js process
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchFXRate(from: string, to: string): Promise<number> {
  if (from === to) return 1.0;

  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    return hit.rate;
  }

  const res = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { next: { revalidate: 0 } } // always fresh on the server
  );

  if (!res.ok) {
    throw new Error(`FX rate unavailable for ${from} → ${to} (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];

  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    throw new Error(`FX rate unavailable for ${from} → ${to}`);
  }

  cache.set(key, { rate, fetchedAt: Date.now() });
  return rate;
}
