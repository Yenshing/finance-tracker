import { fxCache } from '../db/repositories/cacheRepo';

export async function convertToBase(
  amount: number,
  currency: string,
  baseCurrency: string,
): Promise<number | null> {
  if (currency === baseCurrency) return amount;

  const direct = await fxCache.get(currency, baseCurrency);
  if (direct) return amount * direct.rate;

  const inverse = await fxCache.get(baseCurrency, currency);
  if (inverse && inverse.rate !== 0) return amount / inverse.rate;

  return null;
}
