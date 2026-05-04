import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { assetsRepo } from '../src/db/repositories/assetsRepo';
import { settingsRepo } from '../src/db/repositories/settingsRepo';
import {
  exportAll,
  parseImportFile,
  replaceAll,
} from '../src/services/io/exportImport';

afterEach(async () => {
  await db.assets.clear();
  await db.snapshots.clear();
  await db.priceCache.clear();
  await db.fxCache.clear();
  await db.settings.clear();
});

describe('export/import round-trip', () => {
  it('preserves snapshots through JSON serialization', async () => {
    await db.snapshots.add({
      takenAt: 1_700_000_000_000,
      localDate: '2026-05-04',
      baseCurrency: 'TWD',
      totalNetWorth: 1_234_567,
      byCategory: { liquid: 200_000, investment: 800_000, fixed: 234_567 },
      source: 'auto',
    });
    await db.snapshots.add({
      takenAt: 1_700_086_400_000,
      localDate: '2026-05-05',
      baseCurrency: 'TWD',
      totalNetWorth: 1_300_000,
      byCategory: { liquid: 250_000, investment: 800_000, fixed: 250_000 },
      source: 'manual',
    });

    const exported = await exportAll();
    expect(exported.snapshots).toHaveLength(2);

    const parsed = parseImportFile(JSON.parse(JSON.stringify(exported)));
    await db.snapshots.clear();
    const summary = await replaceAll(parsed);
    expect(summary.snapshots).toBe(2);

    const restored = await db.snapshots.orderBy('takenAt').toArray();
    expect(restored.map((s) => s.localDate)).toEqual([
      '2026-05-04',
      '2026-05-05',
    ]);
    expect(restored[0].totalNetWorth).toBe(1_234_567);
    expect(restored[1].source).toBe('manual');
  });

  it('preserves assets and settings through JSON serialization', async () => {
    await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: '玉山',
      currency: 'TWD',
      manualValue: 50_000,
    });
    await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'Apple',
      currency: 'USD',
      symbol: 'AAPL',
      quantity: 10,
      broker: 'sub_broker',
    });
    await settingsRepo.update({ baseCurrency: 'USD' });

    const exported = await exportAll();
    expect(exported.assets).toHaveLength(2);
    expect(exported.settings?.baseCurrency).toBe('USD');

    // simulate JSON round-trip
    const json = JSON.parse(JSON.stringify(exported));
    const parsed = parseImportFile(json);

    // wipe and replace
    await db.assets.clear();
    await db.settings.clear();

    const summary = await replaceAll(parsed);
    expect(summary.assets).toBe(2);
    expect(summary.hasSettings).toBe(true);

    const restored = await assetsRepo.listActive();
    expect(restored.map((a) => a.name).sort()).toEqual(['Apple', '玉山']);
    const settings = await settingsRepo.get();
    expect(settings.baseCurrency).toBe('USD');
  });

  it('rejects malformed JSON', () => {
    expect(() => parseImportFile({ foo: 'bar' })).toThrow();
    expect(() => parseImportFile(null)).toThrow();
    expect(() =>
      parseImportFile({
        version: 1,
        exportedAt: 0,
        settings: null,
        assets: [{ category: 'unknown' }],
        snapshots: [],
      }),
    ).toThrow();
  });
});
