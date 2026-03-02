declare const process: { env: Record<string, string | undefined> };

/**
 * Environment-based key prefix to avoid collisions when multiple deployments
 * share the same Upstash Redis instance (M-6 fix).
 */
function getKeyPrefix(): string {
  const env = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development'
  if (!env || env === 'production') return '';
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'dev';
  return `${env}:${sha}:`;
}

let cachedPrefix: string | undefined;
function prefixKey(key: string): string {
  if (cachedPrefix === undefined) cachedPrefix = getKeyPrefix();
  if (!cachedPrefix) return key;
  return `${cachedPrefix}${key}`;
}

export async function getCachedJson(key: string, rawKey = false): Promise<unknown | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const effectiveKey = rawKey ? key : prefixKey(key);
    const resp = await fetch(`${url}/get/${encodeURIComponent(effectiveKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { result?: string };
    return data.result ? JSON.parse(data.result) : null;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    // Atomic SET with EX — single call avoids race between SET and EXPIRE (C-3 fix)
    await fetch(`${url}/set/${encodeURIComponent(prefixKey(key))}/${encodeURIComponent(JSON.stringify(value))}/EX/${ttlSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3_000),
    });
  } catch { /* best-effort */ }
}

/**
 * Batch GET using Upstash pipeline API — single HTTP round-trip for N keys.
 * Returns a Map of key → parsed JSON value (missing/failed keys omitted).
 */
export async function getCachedJsonBatch(keys: string[]): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  if (keys.length === 0) return result;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return result;

  try {
    const pipeline = keys.map((k) => ['GET', prefixKey(k)]);
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
      signal: AbortSignal.timeout(3_000),
    });
    if (!resp.ok) return result;

    const data = (await resp.json()) as Array<{ result?: string }>;
    for (let i = 0; i < keys.length; i++) {
      const raw = data[i]?.result;
      if (raw) {
        try { result.set(keys[i]!, JSON.parse(raw)); } catch { /* skip malformed */ }
      }
    }
  } catch { /* best-effort */ }
  return result;
}

/**
 * In-flight request coalescing map.
 * When multiple concurrent requests hit the same cache key during a miss,
 * only the first triggers the upstream fetch — others await the same promise.
 * This eliminates duplicate upstream API calls within a single Edge Function invocation.
 */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Check cache, then fetch with coalescing on miss.
 * Concurrent callers for the same key share a single upstream fetch + Redis write.
 */
export async function cachedFetchJson<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  const cached = await getCachedJson(key);
  if (cached !== null) return cached as T;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T | null>;

  const promise = fetcher()
    .then(async (result) => {
      if (result != null) {
        await setCachedJson(key, result, ttlSeconds);
      }
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Like cachedFetchJson but reports the data source.
 * Use when callers need to distinguish cache hits from fresh fetches
 * (e.g. to set provider/cached metadata on responses).
 *
 * Returns { data, source } where source is:
 *   'cache'  — served from Redis
 *   'fresh'  — fetcher ran (leader) or joined an in-flight fetch (follower)
 */
export async function cachedFetchJsonWithMeta<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>,
): Promise<{ data: T | null; source: 'cache' | 'fresh' }> {
  const cached = await getCachedJson(key);
  if (cached !== null) return { data: cached as T, source: 'cache' };

  const existing = inflight.get(key);
  if (existing) {
    const data = (await existing) as T;
    return { data, source: 'fresh' };
  }

  const promise = fetcher()
    .then(async (result) => {
      if (result != null) {
        await setCachedJson(key, result, ttlSeconds);
      }
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  const data = await promise;
  return { data, source: 'fresh' };
}

/**
 * GEOSEARCH by bounding box — uses Upstash REST pipeline.
 * Returns member IDs within the box.
 */
export async function geoSearchByBox(
  key: string,
  lon: number,
  lat: number,
  widthKm: number,
  heightKm: number,
  count: number,
  _rawKeys = false,
): Promise<string[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return [];

  const effectiveKey = _rawKeys ? key : prefixKey(key);
  try {
    const resp = await fetch(`${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        'GEOSEARCH', effectiveKey,
        'FROMLONLAT', String(lon), String(lat),
        'BYBOX', String(widthKm), String(heightKm), 'km',
        'COUNT', String(count), 'ASC',
      ]),
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { result?: string[] };
    return data.result || [];
  } catch {
    return [];
  }
}

/**
 * Batch HGET — fetches multiple hash fields in a single pipeline call.
 * Returns a Map of field → parsed JSON value.
 */
export async function getHashFieldsBatch(
  key: string,
  fields: string[],
  _rawKeys = false,
): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  if (fields.length === 0) return result;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return result;

  const effectiveKey = _rawKeys ? key : prefixKey(key);
  try {
    const pipeline = fields.map((f) => ['HGET', effectiveKey, f]);
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) return result;

    const data = (await resp.json()) as Array<{ result?: string }>;
    for (let i = 0; i < fields.length; i++) {
      const raw = data[i]?.result;
      if (raw) {
        try { result.set(fields[i]!, JSON.parse(raw)); } catch { /* skip */ }
      }
    }
  } catch { /* best-effort */ }
  return result;
}
