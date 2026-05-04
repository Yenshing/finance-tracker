import { db } from '../database';
import type { Asset } from '../types';

export const assetsRepo = {
  async create(input: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = Date.now();
    return db.assets.add({ ...input, createdAt: now, updatedAt: now });
  },

  async update(id: number, patch: Partial<Asset>): Promise<void> {
    await db.assets.update(id, { ...patch, updatedAt: Date.now() });
  },

  async remove(id: number): Promise<void> {
    await db.assets.delete(id);
  },

  async archive(id: number): Promise<void> {
    await db.assets.update(id, { archivedAt: Date.now(), updatedAt: Date.now() });
  },

  async getById(id: number): Promise<Asset | undefined> {
    return db.assets.get(id);
  },

  async listActive(): Promise<Asset[]> {
    const all = await db.assets.toArray();
    return all.filter((a) => !a.archivedAt);
  },
};
