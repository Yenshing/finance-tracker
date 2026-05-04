import type { Asset, PriceCacheRow } from '../db/types';

export type PriceSource = 'cache' | 'manual' | null;

export interface ResolvedValue {
  valueInAssetCurrency: number;
  pricedAt: number | null;
  stale: boolean;
  source: PriceSource;
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
        source: 'cache',
      };
    }
    if (typeof asset.manualUnitPrice === 'number') {
      return {
        valueInAssetCurrency: asset.manualUnitPrice * asset.quantity,
        pricedAt: asset.updatedAt,
        stale: false,
        source: 'manual',
      };
    }
    return { valueInAssetCurrency: 0, pricedAt: null, stale: true, source: null };
  }

  return {
    valueInAssetCurrency: asset.manualValue ?? 0,
    pricedAt: asset.updatedAt,
    stale: false,
    source: null,
  };
}
