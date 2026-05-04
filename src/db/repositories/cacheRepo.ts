import { db } from '../database';
import type { FxCacheRow, PriceCacheRow } from '../types';

export const priceCache = {
  async get(symbol: string): Promise<PriceCacheRow | undefined> {
    return db.priceCache.get(symbol);
  },
  async put(row: PriceCacheRow): Promise<void> {
    await db.priceCache.put(row);
  },
};

export const fxCache = {
  pairKey(from: string, to: string): string {
    return `${from}->${to}`;
  },
  async get(from: string, to: string): Promise<FxCacheRow | undefined> {
    return db.fxCache.get(this.pairKey(from, to));
  },
  async put(row: Omit<FxCacheRow, 'pair'>): Promise<void> {
    await db.fxCache.put({ ...row, pair: this.pairKey(row.from, row.to) });
  },
};
