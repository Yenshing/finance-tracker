export type Category = 'liquid' | 'investment' | 'fixed' | 'receivable' | 'liability';

export type AssetType =
  | 'cash'
  | 'stock'
  | 'crypto'
  | 'real_estate'
  | 'vehicle'
  | 'receivable'
  | 'liability'
  | 'custom';

export interface Asset {
  id?: number;
  category: Category;
  type: AssetType;
  name: string;
  currency: string;
  symbol?: string;
  quantity?: number;
  manualValue?: number;
  notes?: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PriceCacheRow {
  symbol: string;
  price: number;
  currency: string;
  fetchedAt: number;
}

export interface FxCacheRow {
  pair: string;
  from: string;
  to: string;
  rate: number;
  fetchedAt: number;
}

export interface Snapshot {
  id?: number;
  takenAt: number;
  localDate: string;
  baseCurrency: string;
  totalNetWorth: number;
  byCategory: Record<Category, number>;
  byAsset: Array<{ assetId: number; valueInBase: number }>;
  source: 'auto' | 'manual';
}

export interface SettingsRow {
  key: 'app';
  baseCurrency: string;
  lastAutoSnapshotDate?: string;
}
