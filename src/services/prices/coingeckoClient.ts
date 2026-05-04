import { z } from 'zod';
import { priceCache } from '../../db/repositories/cacheRepo';
import type { FetchResult } from './proxyClient';

const ResponseSchema = z.record(
  z.string(),
  z.object({ usd: z.number() }),
);

export async function fetchAndCacheCryptos(ids: string[]): Promise<FetchResult[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    unique.join(','),
  )}&vs_currencies=usd`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return unique.map((id) => ({
      ok: false,
      symbol: id,
      error: `網路錯誤：${(e as Error).message}`,
    }));
  }

  if (!res.ok) {
    return unique.map((id) => ({
      ok: false,
      symbol: id,
      error: `CoinGecko HTTP ${res.status}`,
    }));
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return unique.map((id) => ({ ok: false, symbol: id, error: '回應格式錯誤' }));
  }

  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) {
    return unique.map((id) => ({ ok: false, symbol: id, error: '回應驗證失敗' }));
  }

  const fetchedAt = Date.now();
  const results: FetchResult[] = [];
  for (const id of unique) {
    const row = parsed.data[id];
    if (!row) {
      results.push({ ok: false, symbol: id, error: '找不到此幣' });
      continue;
    }
    await priceCache.put({
      symbol: id,
      price: row.usd,
      currency: 'USD',
      fetchedAt,
    });
    results.push({ ok: true, symbol: id });
  }
  return results;
}
