import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { assetsRepo } from '../src/db/repositories/assetsRepo';
import { buildPortfolioView } from '../src/domain/portfolio';
import type { PriceCacheRow } from '../src/db/types';

const EMPTY_PRICES = new Map<string, PriceCacheRow>();

afterEach(async () => {
  await db.assets.clear();
  await db.snapshots.clear();
  await db.priceCache.clear();
  await db.fxCache.clear();
  await db.settings.clear();
});

describe('portfolio totals', () => {
  it('sums assets across categories in same currency', async () => {
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

    const all = await assetsRepo.listActive();
    const view = await buildPortfolioView(all, 'TWD', EMPTY_PRICES);

    expect(view.totalAssets).toBe(5_100_000);
    expect(view.netWorth).toBe(5_100_000);
    expect(view.byCategory.liquid).toBe(100_000);
    expect(view.byCategory.fixed).toBe(5_000_000);
    expect(view.byCategory.investment).toBe(0);
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
    const view = await buildPortfolioView(all, 'TWD', EMPTY_PRICES);
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

describe('stock pricing', () => {
  it('uses cached price × quantity when available', async () => {
    await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
    });
    const all = await assetsRepo.listActive();
    const priceMap = new Map<string, PriceCacheRow>([
      ['2330.TW', { symbol: '2330.TW', price: 850, currency: 'TWD', fetchedAt: Date.now() }],
    ]);
    const view = await buildPortfolioView(all, 'TWD', priceMap);
    expect(view.totalAssets).toBe(85_000);
    expect(view.staleCount).toBe(0);
  });

  it('marks stock stale when no cached price', async () => {
    await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'Apple',
      currency: 'USD',
      symbol: 'AAPL',
      quantity: 10,
      broker: 'sub_broker',
    });
    const all = await assetsRepo.listActive();
    const view = await buildPortfolioView(all, 'TWD', EMPTY_PRICES);
    expect(view.staleCount).toBe(1);
    expect(view.assets[0].valueInAssetCurrency).toBe(0);
  });
});

describe('legacy data filtering', () => {
  it('drops assets whose category is no longer valid', async () => {
    // simulate legacy row with removed category — bypass type narrowing on purpose
    await db.assets.add({
      // @ts-expect-error legacy category that we no longer support
      category: 'liability',
      type: 'cash',
      name: 'Old debt',
      currency: 'TWD',
      manualValue: 500_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Active',
      currency: 'TWD',
      manualValue: 1000,
    });
    const all = await assetsRepo.listActive();
    const view = await buildPortfolioView(all, 'TWD', EMPTY_PRICES);
    expect(view.totalAssets).toBe(1000);
    expect(view.assets).toHaveLength(1);
  });
});
