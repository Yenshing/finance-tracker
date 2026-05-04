import type { AssetView } from './portfolio';

export type InvestmentBucketKey = 'us_stock' | 'tw_stock' | 'crypto' | 'other';

export interface InvestmentBucketMeta {
  key: InvestmentBucketKey;
  label: string;
  color: string;
  match: (v: AssetView) => boolean;
}

export const INVESTMENT_BUCKETS: InvestmentBucketMeta[] = [
  {
    key: 'us_stock',
    label: '美元股票',
    color: '#2563eb',
    match: (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker !== 'tw_broker',
  },
  {
    key: 'tw_stock',
    label: '台灣股票',
    color: '#dc2626',
    match: (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker === 'tw_broker',
  },
  {
    key: 'crypto',
    label: '加密貨幣',
    color: '#f59e0b',
    match: (v) => v.asset.category === 'investment' && v.asset.type === 'crypto',
  },
  {
    key: 'other',
    label: '其他',
    color: '#6b7280',
    match: (v) => v.asset.category === 'investment' && v.asset.type === 'custom',
  },
];

export function bucketInvestmentTotals(
  assets: AssetView[],
): Record<InvestmentBucketKey, number> {
  const totals = {
    us_stock: 0,
    tw_stock: 0,
    crypto: 0,
    other: 0,
  } as Record<InvestmentBucketKey, number>;

  for (const view of assets) {
    if (view.valueInBase === null) continue;
    const bucket = INVESTMENT_BUCKETS.find((b) => b.match(view));
    if (bucket) totals[bucket.key] += view.valueInBase;
  }
  return totals;
}
