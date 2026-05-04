import type { Asset, Category, PriceCacheRow } from '../db/types';
import { resolveAssetValue, type PriceSource } from './resolveAssetValue';
import { convertToBase } from './convertToBase';
import { VALID_CATEGORY_KEYS } from './categories';

export interface AssetView {
  asset: Asset;
  valueInAssetCurrency: number;
  valueInBase: number | null;
  pricedAt: number | null;
  stale: boolean;
  source: PriceSource;
}

export interface PortfolioView {
  base: string;
  assets: AssetView[];
  byCategory: Record<Category, number>;
  totalAssets: number;
  netWorth: number;
  unconvertibleCount: number;
  staleCount: number;
}

const EMPTY_BY_CATEGORY: Record<Category, number> = {
  liquid: 0,
  investment: 0,
  fixed: 0,
};

export async function buildPortfolioView(
  assets: Asset[],
  baseCurrency: string,
  priceMap: Map<string, PriceCacheRow>,
): Promise<PortfolioView> {
  const valid = assets.filter((a) => VALID_CATEGORY_KEYS.has(a.category));

  const byCategory = { ...EMPTY_BY_CATEGORY };
  let totalAssets = 0;
  let unconvertibleCount = 0;
  let staleCount = 0;

  const views = await Promise.all(
    valid.map(async (asset): Promise<AssetView> => {
      const resolved = resolveAssetValue(asset, priceMap);
      if (resolved.stale) staleCount += 1;

      const valueInBase = await convertToBase(
        resolved.valueInAssetCurrency,
        asset.currency,
        baseCurrency,
      );

      if (valueInBase === null) {
        unconvertibleCount += 1;
      } else {
        byCategory[asset.category] += valueInBase;
        totalAssets += valueInBase;
      }

      return {
        asset,
        valueInAssetCurrency: resolved.valueInAssetCurrency,
        valueInBase,
        pricedAt: resolved.pricedAt,
        stale: resolved.stale,
        source: resolved.source,
      };
    }),
  );

  return {
    base: baseCurrency,
    assets: views,
    byCategory,
    totalAssets,
    netWorth: totalAssets,
    unconvertibleCount,
    staleCount,
  };
}
