import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { assetsRepo } from '../src/db/repositories/assetsRepo';
import {
  createInvestmentWithDeduction,
  deleteInvestmentWithCredit,
  updateInvestmentWithAdjustment,
} from '../src/domain/cashAdjustment';

afterEach(async () => {
  await db.assets.clear();
  await db.snapshots.clear();
  await db.priceCache.clear();
  await db.fxCache.clear();
  await db.settings.clear();
});

describe('createInvestmentWithDeduction', () => {
  it('creates the asset and deducts cash atomically', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Firstrade USD',
      currency: 'USD',
      manualValue: 10_000,
    });

    const newId = await createInvestmentWithDeduction({
      newAsset: {
        category: 'investment',
        type: 'stock',
        name: 'Apple',
        currency: 'USD',
        symbol: 'AAPL',
        quantity: 10,
        broker: 'overseas',
      },
      cashAdjustment: { accountId: cashId, amount: 2_815.41 },
    });

    expect(newId).toBeGreaterThan(0);
    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBeCloseTo(7_184.59, 2);

    const stock = await assetsRepo.getById(newId);
    expect(stock?.symbol).toBe('AAPL');
    expect(stock?.quantity).toBe(10);
  });

  it('creates the asset without touching cash when no adjustment is given', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 100_000,
    });

    await createInvestmentWithDeduction({
      newAsset: {
        category: 'investment',
        type: 'stock',
        name: 'TSMC',
        currency: 'TWD',
        symbol: '2330.TW',
        quantity: 100,
        broker: 'tw_broker',
      },
    });

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(100_000);
  });

  it('rolls back when the cash account is wrong currency', async () => {
    const usdId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'USD',
      currency: 'USD',
      manualValue: 5_000,
    });

    await expect(
      createInvestmentWithDeduction({
        newAsset: {
          category: 'investment',
          type: 'stock',
          name: 'TSMC',
          currency: 'TWD',
          symbol: '2330.TW',
          quantity: 100,
          broker: 'tw_broker',
        },
        cashAdjustment: { accountId: usdId, amount: 200 },
      }),
    ).rejects.toThrow(/幣別不符/);

    // No partial state: USD balance untouched, no TSMC asset created.
    const usd = await assetsRepo.getById(usdId);
    expect(usd?.manualValue).toBe(5_000);
    const all = await assetsRepo.listActive();
    expect(all.find((a) => a.symbol === '2330.TW')).toBeUndefined();
  });

  it('rejects non-liquid accounts', async () => {
    const houseId = await assetsRepo.create({
      category: 'fixed',
      type: 'real_estate',
      name: 'House',
      currency: 'TWD',
      manualValue: 5_000_000,
    });

    await expect(
      createInvestmentWithDeduction({
        newAsset: {
          category: 'investment',
          type: 'stock',
          name: 'TSMC',
          currency: 'TWD',
          symbol: '2330.TW',
          quantity: 100,
          broker: 'tw_broker',
        },
        cashAdjustment: { accountId: houseId, amount: 200 },
      }),
    ).rejects.toThrow(/必須是流動資金/);
  });
});

describe('deleteInvestmentWithCredit', () => {
  it('deletes the asset and credits cash atomically', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 50_000,
    });
    const stockId = await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
    });

    await deleteInvestmentWithCredit({
      assetIdToDelete: stockId,
      cashAdjustment: { accountId: cashId, amount: 227_300 },
    });

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(277_300);
    const stock = await assetsRepo.getById(stockId);
    expect(stock).toBeUndefined();
  });

  it('rolls back when target asset does not exist', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 50_000,
    });

    await expect(
      deleteInvestmentWithCredit({
        assetIdToDelete: 99999,
        cashAdjustment: { accountId: cashId, amount: 1_000 },
      }),
    ).rejects.toThrow(/不存在/);

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(50_000);
  });
});

describe('updateInvestmentWithAdjustment', () => {
  it('updates the asset and credits cash (sell-some scenario)', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 50_000,
    });
    const stockId = await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
    });

    await updateInvestmentWithAdjustment({
      assetIdToUpdate: stockId,
      updatePayload: { quantity: 60 },
      cashAdjustment: {
        accountId: cashId,
        amount: 40_000,
        direction: 'credit',
      },
    });

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(90_000);
    const stock = await assetsRepo.getById(stockId);
    expect(stock?.quantity).toBe(60);
  });

  it('updates the asset and deducts cash (add-on buy scenario)', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 100_000,
    });
    const stockId = await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
    });

    await updateInvestmentWithAdjustment({
      assetIdToUpdate: stockId,
      updatePayload: { quantity: 150 },
      cashAdjustment: {
        accountId: cashId,
        amount: 30_000,
        direction: 'deduct',
      },
    });

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(70_000);
    const stock = await assetsRepo.getById(stockId);
    expect(stock?.quantity).toBe(150);
  });

  it('updates without touching cash when no adjustment is given', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 100_000,
    });
    const stockId = await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
    });

    await updateInvestmentWithAdjustment({
      assetIdToUpdate: stockId,
      updatePayload: { name: 'TSMC ADR' },
    });

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(100_000);
    const stock = await assetsRepo.getById(stockId);
    expect(stock?.name).toBe('TSMC ADR');
  });

  it('rolls back when the cash account is wrong currency', async () => {
    const usdId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'USD',
      currency: 'USD',
      manualValue: 5_000,
    });
    const stockId = await assetsRepo.create({
      category: 'investment',
      type: 'stock',
      name: 'TSMC',
      currency: 'TWD',
      symbol: '2330.TW',
      quantity: 100,
      broker: 'tw_broker',
    });

    await expect(
      updateInvestmentWithAdjustment({
        assetIdToUpdate: stockId,
        updatePayload: { quantity: 50 },
        cashAdjustment: {
          accountId: usdId,
          amount: 1_000,
          direction: 'credit',
        },
      }),
    ).rejects.toThrow(/幣別不符/);

    const usd = await assetsRepo.getById(usdId);
    expect(usd?.manualValue).toBe(5_000);
    const stock = await assetsRepo.getById(stockId);
    expect(stock?.quantity).toBe(100);
  });

  it('rolls back when target asset does not exist', async () => {
    const cashId = await assetsRepo.create({
      category: 'liquid',
      type: 'cash',
      name: 'Bank',
      currency: 'TWD',
      manualValue: 50_000,
    });

    await expect(
      updateInvestmentWithAdjustment({
        assetIdToUpdate: 99999,
        updatePayload: { quantity: 50 },
        cashAdjustment: {
          accountId: cashId,
          amount: 1_000,
          direction: 'credit',
        },
      }),
    ).rejects.toThrow(/不存在/);

    const cash = await assetsRepo.getById(cashId);
    expect(cash?.manualValue).toBe(50_000);
  });
});
