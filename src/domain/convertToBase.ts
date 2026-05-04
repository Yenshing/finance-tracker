import { fxCache } from '../db/repositories/cacheRepo';

/**
 * Phase 1: returns the amount unchanged when currencies match;
 * returns null otherwise (multi-currency lands in Phase 2).
 */
export async function convertToBase(
  amount: number,
  currency: string,
  baseCurrency: string,
): Promise<number | null> {
  if (currency === baseCurrency) return amount;

  const direct = await fxCache.get(currency, baseCurrency);
  if (direct) return amount * direct.rate;

  return null;
}
