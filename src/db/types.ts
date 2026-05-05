export type Category = 'liquid' | 'investment' | 'fixed';

export type AssetType =
  | 'cash'
  | 'stock'
  | 'crypto'
  | 'real_estate'
  | 'vehicle'
  | 'custom';

export type Broker = 'sub_broker' | 'overseas' | 'tw_broker';

export interface Asset {
  id?: number;
  category: Category;
  type: AssetType;
  name: string;
  currency: string;
  symbol?: string;
  quantity?: number;
  broker?: Broker;
  manualValue?: number;
  manualUnitPrice?: number;
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
  source: 'auto' | 'manual';
}

export interface LinkedFileMeta {
  /** Persisted FileSystemFileHandle. Survives reload via IndexedDB structured-clone. */
  handle: FileSystemFileHandle;
  /** Display name shown in UI. */
  name: string;
  /** When the user first picked this file. */
  linkedAt: number;
  /** Last time we wrote DB state to the file. */
  lastWriteAt: number;
  /** The `exportedAt` value of the last bundle we wrote — used for reconciliation. */
  lastWriteExportedAt: number;
}

export interface SettingsRow {
  key: 'app';
  baseCurrency: string;
  lastAutoSnapshotDate?: string;
  linkedFile?: LinkedFileMeta;
}
