import { db } from '../db/database';
import type { Asset } from '../db/types';

export interface CashAdjustment {
  /** Liquid asset id whose manualValue will move. */
  accountId: number;
  /** Positive amount in the same currency as the investment asset. */
  amount: number;
}

export interface CreateInvestmentInput {
  newAsset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>;
  /** When provided, deducts `amount` from the chosen liquid account. */
  cashAdjustment?: CashAdjustment;
}

export interface DeleteInvestmentInput {
  assetIdToDelete: number;
  /** When provided, credits `amount` into the chosen liquid account. */
  cashAdjustment?: CashAdjustment;
}

export type AdjustmentDirection = 'credit' | 'deduct';

export interface DirectionalCashAdjustment extends CashAdjustment {
  /** 'credit' adds to the liquid account; 'deduct' subtracts from it. */
  direction: AdjustmentDirection;
}

export interface UpdateInvestmentInput {
  assetIdToUpdate: number;
  updatePayload: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>;
  /**
   * When provided, adjusts the chosen liquid account by `amount` in the
   * given direction (e.g. 'credit' for sell/reduce, 'deduct' for add-on buy).
   */
  cashAdjustment?: DirectionalCashAdjustment;
}

/**
 * Create the investment asset and (optionally) deduct cost from a liquid
 * account in one Dexie transaction.
 *
 * Validation:
 *   - cash account must exist, must be category='liquid', same currency.
 *   - amount must be > 0; we don't block negative resulting balances (margin
 *     and similar use cases are legitimate). The UI surfaces a warning.
 */
export async function createInvestmentWithDeduction(
  input: CreateInvestmentInput,
): Promise<number> {
  const { newAsset, cashAdjustment } = input;
  const now = Date.now();
  let newId = 0;

  await db.transaction('rw', db.assets, async () => {
    newId = (await db.assets.add({
      ...newAsset,
      createdAt: now,
      updatedAt: now,
    })) as number;

    if (cashAdjustment) {
      validateAdjustmentInput(cashAdjustment);
      const cash = await loadAndValidateLiquid(
        cashAdjustment.accountId,
        newAsset.currency,
        '扣款',
      );
      await db.assets.update(cashAdjustment.accountId, {
        manualValue: (cash.manualValue ?? 0) - cashAdjustment.amount,
        updatedAt: now,
      });
    }
  });

  return newId;
}

export async function deleteInvestmentWithCredit(
  input: DeleteInvestmentInput,
): Promise<void> {
  const { assetIdToDelete, cashAdjustment } = input;
  const now = Date.now();

  await db.transaction('rw', db.assets, async () => {
    const target = await db.assets.get(assetIdToDelete);
    if (!target) throw new Error('資產不存在');

    if (cashAdjustment) {
      validateAdjustmentInput(cashAdjustment);
      const cash = await loadAndValidateLiquid(
        cashAdjustment.accountId,
        target.currency,
        '入帳',
      );
      await db.assets.update(cashAdjustment.accountId, {
        manualValue: (cash.manualValue ?? 0) + cashAdjustment.amount,
        updatedAt: now,
      });
    }

    await db.assets.delete(assetIdToDelete);
  });
}

/**
 * Update an investment and (optionally) credit or deduct a liquid account in
 * one Dexie transaction. Mirrors {@link deleteInvestmentWithCredit} but for
 * the edit flow, with a configurable direction so the same UI handles both
 * sell-some (credit) and add-on-buy (deduct) cases.
 */
export async function updateInvestmentWithAdjustment(
  input: UpdateInvestmentInput,
): Promise<void> {
  const { assetIdToUpdate, updatePayload, cashAdjustment } = input;
  const now = Date.now();

  await db.transaction('rw', db.assets, async () => {
    const target = await db.assets.get(assetIdToUpdate);
    if (!target) throw new Error('資產不存在');

    if (cashAdjustment) {
      validateAdjustmentInput(cashAdjustment);
      const role = cashAdjustment.direction === 'credit' ? '入帳' : '扣款';
      const currency = updatePayload.currency ?? target.currency;
      const cash = await loadAndValidateLiquid(
        cashAdjustment.accountId,
        currency,
        role,
      );
      const delta =
        cashAdjustment.direction === 'credit'
          ? cashAdjustment.amount
          : -cashAdjustment.amount;
      await db.assets.update(cashAdjustment.accountId, {
        manualValue: (cash.manualValue ?? 0) + delta,
        updatedAt: now,
      });
    }

    await db.assets.update(assetIdToUpdate, {
      ...updatePayload,
      updatedAt: now,
    });
  });
}

function validateAdjustmentInput(adj: CashAdjustment): void {
  if (!Number.isFinite(adj.amount) || adj.amount <= 0) {
    throw new Error('金額必須大於 0');
  }
  if (!Number.isInteger(adj.accountId)) {
    throw new Error('帳戶 ID 不正確');
  }
}

async function loadAndValidateLiquid(
  accountId: number,
  expectedCurrency: string,
  role: '扣款' | '入帳',
): Promise<Asset> {
  const cash = await db.assets.get(accountId);
  if (!cash) throw new Error(`${role}帳戶不存在`);
  if (cash.category !== 'liquid') {
    throw new Error(`${role}帳戶必須是流動資金`);
  }
  if (cash.currency !== expectedCurrency) {
    throw new Error(
      `${role}帳戶幣別不符：需要 ${expectedCurrency}，但帳戶為 ${cash.currency}`,
    );
  }
  return cash;
}
