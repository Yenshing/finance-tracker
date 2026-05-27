import type { AssetView } from './portfolio';

export type InvestmentBucketKey =
  | 'us_sub_broker'
  | 'us_overseas'
  | 'tw_stock'
  | 'crypto'
  | 'other';

export interface InvestmentBucketMeta {
  key: InvestmentBucketKey;
  label: string;
  color: string;
  /** True for buckets that can drill into a per-asset treemap. */
  hasTreemap: boolean;
  match: (v: AssetView) => boolean;
}

/**
 * Shared parent identity for sub_broker + overseas — used by the asset list
 * to group both under "美元股票". Not a bucket of its own (no `match`),
 * because the donut / snapshot view both treat sub_broker and overseas as
 * independent slices.
 */
export const US_STOCK_PARENT = {
  label: '美元股票',
  color: '#2563eb',
} as const;

export const INVESTMENT_BUCKETS: InvestmentBucketMeta[] = [
  {
    key: 'us_sub_broker',
    label: '複委託',
    color: '#60a5fa',
    hasTreemap: true,
    match: (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker === 'sub_broker',
  },
  {
    key: 'us_overseas',
    label: '海外券商',
    color: '#1d4ed8',
    hasTreemap: true,
    match: (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker === 'overseas',
  },
  {
    key: 'tw_stock',
    label: '台灣股票',
    color: '#dc2626',
    hasTreemap: true,
    match: (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker === 'tw_broker',
  },
  {
    key: 'crypto',
    label: '加密貨幣',
    color: '#f59e0b',
    hasTreemap: false,
    match: (v) => v.asset.category === 'investment' && v.asset.type === 'crypto',
  },
  {
    key: 'other',
    label: '其他',
    color: '#6b7280',
    hasTreemap: false,
    match: (v) => v.asset.category === 'investment' && v.asset.type === 'custom',
  },
];

export const INVESTMENT_BUCKET_BY_KEY: Record<
  InvestmentBucketKey,
  InvestmentBucketMeta
> = Object.fromEntries(INVESTMENT_BUCKETS.map((b) => [b.key, b])) as Record<
  InvestmentBucketKey,
  InvestmentBucketMeta
>;

export function bucketInvestmentTotals(
  assets: AssetView[],
): Record<InvestmentBucketKey, number> {
  const totals: Record<InvestmentBucketKey, number> = {
    us_sub_broker: 0,
    us_overseas: 0,
    tw_stock: 0,
    crypto: 0,
    other: 0,
  };

  for (const view of assets) {
    if (view.valueInBase === null) continue;
    const bucket = INVESTMENT_BUCKETS.find((b) => b.match(view));
    if (bucket) totals[bucket.key] += view.valueInBase;
  }
  return totals;
}
