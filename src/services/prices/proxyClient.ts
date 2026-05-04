import { z } from 'zod';
import { priceCache } from '../../db/repositories/cacheRepo';

const QuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  currency: z.string(),
  asOf: z.number(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

export interface FetchResult {
  ok: boolean;
  symbol: string;
  error?: string;
}

export async function fetchAndCacheQuote(symbol: string): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
  } catch (e) {
    return { ok: false, symbol, error: `網路錯誤：${(e as Error).message}` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, symbol, error: '回應格式錯誤' };
  }

  if (!res.ok) {
    const parsed = ErrorSchema.safeParse(body);
    return {
      ok: false,
      symbol,
      error: parsed.success ? parsed.data.error : `HTTP ${res.status}`,
    };
  }

  const parsed = QuoteSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, symbol, error: '回應驗證失敗' };
  }

  await priceCache.put({
    symbol: parsed.data.symbol,
    price: parsed.data.price,
    currency: parsed.data.currency,
    fetchedAt: parsed.data.asOf,
  });
  return { ok: true, symbol: parsed.data.symbol };
}

export async function fetchAndCacheMany(symbols: string[]): Promise<FetchResult[]> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  return Promise.all(unique.map(fetchAndCacheQuote));
}
