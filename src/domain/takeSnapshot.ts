import { db } from '../db/database';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { snapshotsRepo } from '../db/repositories/snapshotsRepo';
import { todayLocalDate } from '../lib/timezone';
import { VALID_CATEGORY_KEYS } from './categories';
import { bucketInvestmentTotals } from './investmentBuckets';
import { buildPortfolioView } from './portfolio';

/**
 * Compute current net-worth totals and upsert today's snapshot.
 * Idempotent: subsequent calls on the same local date overwrite the row.
 */
export async function takeSnapshot(source: 'auto' | 'manual'): Promise<void> {
  const [settings, allAssets, prices] = await Promise.all([
    settingsRepo.get(),
    db.assets.toArray(),
    db.priceCache.toArray(),
  ]);

  const activeAssets = allAssets.filter(
    (a) => !a.archivedAt && VALID_CATEGORY_KEYS.has(a.category),
  );
  const priceMap = new Map(prices.map((p) => [p.symbol, p]));
  const portfolio = await buildPortfolioView(
    activeAssets,
    settings.baseCurrency,
    priceMap,
  );

  await snapshotsRepo.upsertByLocalDate({
    takenAt: Date.now(),
    localDate: todayLocalDate(),
    baseCurrency: settings.baseCurrency,
    totalNetWorth: portfolio.netWorth,
    byCategory: portfolio.byCategory,
    byInvestmentBucket: bucketInvestmentTotals(portfolio.assets),
    source,
  });
}
