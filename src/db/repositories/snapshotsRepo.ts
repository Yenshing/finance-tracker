import { db } from '../database';
import type { Snapshot } from '../types';

export const snapshotsRepo = {
  async upsertByLocalDate(snapshot: Omit<Snapshot, 'id'>): Promise<number> {
    const existing = await db.snapshots.where('localDate').equals(snapshot.localDate).first();
    if (existing?.id) {
      await db.snapshots.update(existing.id, snapshot);
      return existing.id;
    }
    return db.snapshots.add(snapshot);
  },

  async listAll(): Promise<Snapshot[]> {
    return db.snapshots.orderBy('takenAt').toArray();
  },

  async remove(id: number): Promise<void> {
    await db.snapshots.delete(id);
  },
};
