import type { Asset } from '../db/types';

export interface ResolvedValue {
  valueInAssetCurrency: number;
  pricedAt: number | null;
  stale: boolean;
}

/**
 * Phase 1: only manualValue is supported.
 * Phase 3 will add stock/crypto resolution via priceCache.
 */
export function resolveAssetValue(asset: Asset): ResolvedValue {
  if (asset.type === 'stock' || asset.type === 'crypto') {
    return { valueInAssetCurrency: 0, pricedAt: null, stale: true };
  }
  return {
    valueInAssetCurrency: asset.manualValue ?? 0,
    pricedAt: asset.updatedAt,
    stale: false,
  };
}
