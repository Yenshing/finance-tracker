import type { Asset, Category } from '../db/types';
import { resolveAssetValue } from './resolveAssetValue';
import { convertToBase } from './convertToBase';

export interface AssetView {
  asset: Asset;
  valueInAssetCurrency: number;
  valueInBase: number | null;
  signedValueInBase: number | null;
  stale: boolean;
}

export interface PortfolioView {
  base: string;
  assets: AssetView[];
  byCategory: Record<Category, number>;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  unconvertibleCount: number;
}

const EMPTY_BY_CATEGORY: Record<Category, number> = {
  liquid: 0,
  investment: 0,
  fixed: 0,
  receivable: 0,
  liability: 0,
};

export async function buildPortfolioView(
  assets: Asset[],
  baseCurrency: string,
): Promise<PortfolioView> {
  const byCategory = { ...EMPTY_BY_CATEGORY };
  let totalAssets = 0;
  let totalLiabilities = 0;
  let unconvertibleCount = 0;

  const views = await Promise.all(
    assets.map(async (asset): Promise<AssetView> => {
      const resolved = resolveAssetValue(asset);
      const valueInBase = await convertToBase(
        resolved.valueInAssetCurrency,
        asset.currency,
        baseCurrency,
      );
      const sign = asset.category === 'liability' ? -1 : 1;
      const signedValueInBase = valueInBase === null ? null : valueInBase * sign;

      if (valueInBase === null) {
        unconvertibleCount += 1;
      } else {
        byCategory[asset.category] += valueInBase;
        if (asset.category === 'liability') {
          totalLiabilities += valueInBase;
        } else {
          totalAssets += valueInBase;
        }
      }

      return {
        asset,
        valueInAssetCurrency: resolved.valueInAssetCurrency,
        valueInBase,
        signedValueInBase,
        stale: resolved.stale,
      };
    }),
  );

  return {
    base: baseCurrency,
    assets: views,
    byCategory,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    unconvertibleCount,
  };
}
