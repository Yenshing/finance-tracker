import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  FxCacheRow,
  PriceCacheRow,
  SettingsRow,
  Snapshot,
} from './types';

export class AppDB extends Dexie {
  assets!: Table<Asset, number>;
  priceCache!: Table<PriceCacheRow, string>;
  fxCache!: Table<FxCacheRow, string>;
  snapshots!: Table<Snapshot, number>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('finance-tracker');
    this.version(1).stores({
      assets: '++id, category, type, currency, symbol, archivedAt, updatedAt',
      priceCache: 'symbol, fetchedAt',
      fxCache: 'pair, fetchedAt',
      snapshots: '++id, &localDate, takenAt',
      settings: 'key',
    });
  }
}

export const db = new AppDB();
