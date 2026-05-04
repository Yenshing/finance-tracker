import { z } from 'zod';
import { fxCache } from '../../db/repositories/cacheRepo';
import { FX_BASE, FX_PEERS } from '../../lib/currencies';

const RatesSchema = z.object({
  result: z.literal('success'),
  base_code: z.string(),
  time_last_update_unix: z.number(),
  rates: z.record(z.string(), z.number()),
});

export interface FxRefreshResult {
  ok: boolean;
  fetchedAt: number | null;
  error?: string;
}

export async function fetchAndCacheFx(): Promise<FxRefreshResult> {
  let res: Response;
  try {
    res = await fetch(`https://open.er-api.com/v6/latest/${FX_BASE}`);
  } catch (e) {
    return { ok: false, fetchedAt: null, error: `網路錯誤：${(e as Error).message}` };
  }

  if (!res.ok) {
    return { ok: false, fetchedAt: null, error: `HTTP ${res.status}` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, fetchedAt: null, error: '回應格式錯誤' };
  }

  const parsed = RatesSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, fetchedAt: null, error: '回應驗證失敗' };
  }

  const fetchedAt = parsed.data.time_last_update_unix * 1000;
  for (const peer of FX_PEERS) {
    const rate = parsed.data.rates[peer];
    if (typeof rate !== 'number') continue;
    await fxCache.put({ from: FX_BASE, to: peer, rate, fetchedAt });
  }

  return { ok: true, fetchedAt };
}

const STALE_MS = 12 * 60 * 60 * 1000;

export async function ensureFreshFx(): Promise<FxRefreshResult | null> {
  const existing = await fxCache.get(FX_BASE, FX_PEERS[0]);
  if (existing && Date.now() - existing.fetchedAt < STALE_MS) {
    return null;
  }
  return fetchAndCacheFx();
}
