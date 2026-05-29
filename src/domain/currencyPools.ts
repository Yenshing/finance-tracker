import type { AssetView } from './portfolio';
import {
  INVESTMENT_BUCKETS,
  type InvestmentBucketKey,
} from './investmentBuckets';

export interface CurrencyPool {
  currency: string;
  liquid: number;
  byBucket: Record<InvestmentBucketKey, number>;
  total: number;
}

const EMPTY_BUCKETS: Record<InvestmentBucketKey, number> = {
  us_sub_broker: 0,
  us_overseas: 0,
  tw_stock: 0,
  crypto: 0,
  other: 0,
};

/**
 * Aggregate liquid + investment assets by their asset.currency.
 * Fixed assets (real estate, vehicles) are excluded — they don't
 * meaningfully participate in the cash/investment pool.
 * Values are in base currency.
 */
export function computeCurrencyPools(assets: AssetView[]): CurrencyPool[] {
  const pools = new Map<string, CurrencyPool>();
  for (const view of assets) {
    if (view.valueInBase === null) continue;
    const cat = view.asset.category;
    if (cat === 'fixed') continue;

    const cur = view.asset.currency.toUpperCase();
    let pool = pools.get(cur);
    if (!pool) {
      pool = {
        currency: cur,
        liquid: 0,
        byBucket: { ...EMPTY_BUCKETS },
        total: 0,
      };
      pools.set(cur, pool);
    }

    if (cat === 'liquid') {
      pool.liquid += view.valueInBase;
    } else if (cat === 'investment') {
      const bucket = INVESTMENT_BUCKETS.find((b) => b.match(view));
      if (bucket) pool.byBucket[bucket.key] += view.valueInBase;
    }
    pool.total += view.valueInBase;
  }
  return Array.from(pools.values())
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);
}

const CURRENCY_COLOR: Record<string, string> = {
  TWD: '#16a34a',
  USD: '#2563eb',
  EUR: '#9333ea',
  JPY: '#dc2626',
  GBP: '#0891b2',
  HKD: '#db2777',
  CNY: '#ea580c',
};

const FALLBACK_COLORS = ['#6b7280', '#0f766e', '#a855f7', '#ea580c', '#84cc16'];

export function currencyColor(currency: string, index = 0): string {
  return (
    CURRENCY_COLOR[currency.toUpperCase()] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}
