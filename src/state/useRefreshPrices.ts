import { useState } from 'react';
import { db } from '../db/database';
import { fetchAndCacheMany } from '../services/prices/proxyClient';
import { fetchAndCacheCryptos } from '../services/prices/coingeckoClient';
import { fetchAndCacheFx } from '../services/fx/erApiClient';
import { takeSnapshot } from '../domain/takeSnapshot';

export interface RefreshState {
  loading: boolean;
  lastRunAt: number | null;
  errors: string[];
}

export function useRefreshPrices() {
  const [state, setState] = useState<RefreshState>({
    loading: false,
    lastRunAt: null,
    errors: [],
  });

  async function refresh() {
    setState((s) => ({ ...s, loading: true, errors: [] }));

    const [fxResult, stockErrors, cryptoErrors] = await Promise.all([
      fetchAndCacheFx(),
      refreshStockPrices(),
      refreshCryptoPrices(),
    ]);

    const errors = [...stockErrors, ...cryptoErrors];
    if (!fxResult.ok) errors.push(`匯率：${fxResult.error ?? '失敗'}`);

    // After fresh data lands in caches, refresh today's snapshot too.
    try {
      await takeSnapshot('auto');
    } catch (e) {
      errors.push(`快照：${(e as Error).message}`);
    }

    setState({ loading: false, lastRunAt: Date.now(), errors });
  }

  return { ...state, refresh };
}

async function refreshStockPrices(): Promise<string[]> {
  const assets = await db.assets.toArray();
  const symbols = assets
    .filter(
      (a) =>
        !a.archivedAt &&
        a.type === 'stock' &&
        a.symbol &&
        !a.symbol.endsWith('.TW'),
    )
    .map((a) => a.symbol!);
  if (symbols.length === 0) return [];
  const results = await fetchAndCacheMany(symbols);
  return results
    .filter((r) => !r.ok)
    .map((r) => `${r.symbol}：${r.error ?? '失敗'}`);
}

async function refreshCryptoPrices(): Promise<string[]> {
  const assets = await db.assets.toArray();
  const ids = assets
    .filter((a) => !a.archivedAt && a.type === 'crypto' && a.symbol)
    .map((a) => a.symbol!);
  if (ids.length === 0) return [];
  const results = await fetchAndCacheCryptos(ids);
  return results
    .filter((r) => !r.ok)
    .map((r) => `${r.symbol}：${r.error ?? '失敗'}`);
}
