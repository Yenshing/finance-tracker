import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { assetsRepo } from '../src/db/repositories/assetsRepo';
import { snapshotsRepo } from '../src/db/repositories/snapshotsRepo';
import { takeSnapshot } from '../src/domain/takeSnapshot';

afterEach(async () => {
  await db.assets.clear();
  await db.snapshots.clear();
  await db.priceCache.clear();
  await db.fxCache.clear();
  await db.settings.clear();
});

describe('takeSnapshot', () => {
  it('persists per-bucket investment totals (us / tw / crypto / other)', async () => {
    await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank TWD',
      currency: 'TWD',
      manualValue: 100_000,
    });
    await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
      manualUnitPrice: 1_000,
    });
    await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'Apple',
      currency: 'TWD',
      symbol: 'AAPL',
      quantity: 10,
      broker: 'sub_broker',
      manualUnitPrice: 5_000,
    });
    await assetsRepo.create({
      category: 'investment',
      type: 'custom',
      name: 'Private fund',
      currency: 'TWD',
      manualValue: 30_000,
    });

    await takeSnapshot('manual');

    const all = await snapshotsRepo.listAll();
    expect(all).toHaveLength(1);
    const snap = all[0];

    expect(snap.byInvestmentBucket).toBeDefined();
    expect(snap.byInvestmentBucket?.tw_stock).toBe(100_000);
    expect(snap.byInvestmentBucket?.us_stock).toBe(50_000);
    expect(snap.byInvestmentBucket?.crypto).toBe(0);
    expect(snap.byInvestmentBucket?.other).toBe(30_000);
    // Sum equals the category total so charts can derive 投資合計 consistently.
    expect(snap.byCategory.investment).toBe(180_000);
  });
});
