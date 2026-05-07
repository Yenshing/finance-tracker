import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  FxCacheRow,
  PriceCacheRow,
  SettingsRow,
  Snapshot,
} from './types';
import { notifyDataChange } from '../services/io/changeTracker';
import { dbNameFor, getActiveUserId } from '../state/userRegistry';

export class AppDB extends Dexie {
  assets!: Table<Asset, number>;
  priceCache!: Table<PriceCacheRow, string>;
  fxCache!: Table<FxCacheRow, string>;
  snapshots!: Table<Snapshot, number>;
  settings!: Table<SettingsRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      assets: '++id, category, type, currency, symbol, archivedAt, updatedAt',
      priceCache: 'symbol, fetchedAt',
      fxCache: 'pair, fetchedAt',
      snapshots: '++id, &localDate, takenAt',
      settings: 'key',
    });
  }
}

// The active user is resolved once at module load. Switching users requires
// a page reload so all useLiveQuery subscriptions re-target the new DB.
export const db = new AppDB(dbNameFor(getActiveUserId()));

// Notify subscribers (e.g. file sync) of any change to user data.
// Cache tables are excluded — they're regenerable and not part of the backup file.
for (const table of [db.assets, db.snapshots, db.settings]) {
  table.hook('creating', () => {
    notifyDataChange();
  });
  table.hook('updating', () => {
    notifyDataChange();
  });
  table.hook('deleting', () => {
    notifyDataChange();
  });
}

/**
 * Permanently drop the IndexedDB database for a given user.
 * Used by the user-management UI to clean up after deletion.
 */
export async function dropUserDatabase(userId: string): Promise<void> {
  await Dexie.delete(dbNameFor(userId));
}
