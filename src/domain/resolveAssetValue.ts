import type { Asset, PriceCacheRow } from '../db/types';

export interface ResolvedValue {
  valueInAssetCurrency: number;
  pricedAt: number | null;
  stale: boolean;
}

export function resolveAssetValue(
  asset: Asset,
  priceMap: Map<string, PriceCacheRow>,
): ResolvedValue {
  const isPriced = asset.type === 'stock' || asset.type === 'crypto';
  if (isPriced && asset.symbol && typeof asset.quantity === 'number') {
    const cached = priceMap.get(asset.symbol);
    if (cached) {
      return {
        valueInAssetCurrency: cached.price * asset.quantity,
        pricedAt: cached.fetchedAt,
        stale: false,
      };
    }
    return { valueInAssetCurrency: 0, pricedAt: null, stale: true };
  }

  return {
    valueInAssetCurrency: asset.manualValue ?? 0,
    pricedAt: asset.updatedAt,
    stale: false,
  };
}
