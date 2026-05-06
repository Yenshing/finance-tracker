import { db } from '../database';
import type { LinkedFileMeta, SettingsRow } from '../types';

const DEFAULT: SettingsRow = { key: 'app', baseCurrency: 'TWD' };

export const settingsRepo = {
  async get(): Promise<SettingsRow> {
    const row = await db.settings.get('app');
    return row ?? DEFAULT;
  },

  async update(patch: Partial<Omit<SettingsRow, 'key'>>): Promise<void> {
    const current = (await db.settings.get('app')) ?? DEFAULT;
    await db.settings.put({ ...current, ...patch });
  },

  async setLinkedFile(meta: LinkedFileMeta): Promise<void> {
    const current = (await db.settings.get('app')) ?? DEFAULT;
    await db.settings.put({ ...current, linkedFile: meta });
  },

  async clearLinkedFile(): Promise<void> {
    const current = (await db.settings.get('app')) ?? DEFAULT;
    const { linkedFile: _drop, ...rest } = current;
    void _drop;
    await db.settings.put(rest as SettingsRow);
  },

  async updateLinkedFileWriteMeta(patch: {
    lastWriteAt: number;
    lastWriteExportedAt: number;
  }): Promise<void> {
    const current = (await db.settings.get('app')) ?? DEFAULT;
    if (!current.linkedFile) return;
    await db.settings.put({
      ...current,
      linkedFile: { ...current.linkedFile, ...patch },
    });
  },
};
