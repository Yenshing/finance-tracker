import type { AssetView } from './portfolio';

export type LiquidBucketKey = 'usd_cash' | 'twd_cash';

export interface LiquidBucketMeta {
  key: LiquidBucketKey;
  label: string;
  color: string;
  currency: string;
}

export const LIQUID_BUCKETS: LiquidBucketMeta[] = [
  { key: 'usd_cash', label: '美元現金', color: '#0891b2', currency: 'USD' },
  { key: 'twd_cash', label: '台幣現金', color: '#ea580c', currency: 'TWD' },
];

export const LIQUID_BUCKET_BY_KEY: Record<LiquidBucketKey, LiquidBucketMeta> =
  Object.fromEntries(LIQUID_BUCKETS.map((b) => [b.key, b])) as Record<
    LiquidBucketKey,
    LiquidBucketMeta
  >;

export function bucketOfLiquid(view: AssetView): LiquidBucketKey | null {
  if (view.asset.category !== 'liquid') return null;
  if (view.asset.currency === 'USD') return 'usd_cash';
  if (view.asset.currency === 'TWD') return 'twd_cash';
  return null;
}
