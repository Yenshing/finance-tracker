import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { assetsRepo } from '../src/db/repositories/assetsRepo';
import { buildPortfolioView } from '../src/domain/portfolio';

afterEach(async () => {
  await db.assets.clear();
  await db.snapshots.clear();
  await db.priceCache.clear();
  await db.fxCache.clear();
  await db.settings.clear();
});

describe('portfolio totals', () => {
  it('sums assets in same currency and subtracts liabilities', async () => {
    await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 100_000,
    });
    await assetsRepo.create({
      category: 'fixed',
      type: 'real_estate',
      name: 'House',
      currency: 'TWD',
      manualValue: 5_000_000,
    });
    await assetsRepo.create({
      category: 'liability',
      type: 'liability',
      name: 'Mortgage',
      currency: 'TWD',
      manualValue: 3_000_000,
    });

    const all = await assetsRepo.listActive();
    const view = await buildPortfolioView(all, 'TWD');

    expect(view.totalAssets).toBe(5_100_000);
    expect(view.totalLiabilities).toBe(3_000_000);
    expect(view.netWorth).toBe(2_100_000);
    expect(view.byCategory.liquid).toBe(100_000);
    expect(view.byCategory.fixed).toBe(5_000_000);
    expect(view.byCategory.liability).toBe(3_000_000);
  });

  it('flags unconvertible assets when FX missing', async () => {
    await assetsRepo.create({
      category: 'investment',
      type: 'custom',
      name: 'US ETF',
      currency: 'USD',
      manualValue: 1000,
    });
    const all = await assetsRepo.listActive();
    const view = await buildPortfolioView(all, 'TWD');
    expect(view.unconvertibleCount).toBe(1);
    expect(view.totalAssets).toBe(0);
  });

  it('archives are excluded from listActive', async () => {
    const id = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Old account',
      currency: 'TWD',
      manualValue: 500,
    });
    await assetsRepo.archive(id);
    const all = await assetsRepo.listActive();
    expect(all).toHaveLength(0);
  });
});
