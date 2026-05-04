import { db } from '../database';
import type { SettingsRow } from '../types';

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
};
