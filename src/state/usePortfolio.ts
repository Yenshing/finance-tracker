import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { buildPortfolioView, type PortfolioView } from '../domain/portfolio';
import type { FxCacheRow } from '../db/types';

export function usePortfolio(): PortfolioView | undefined {
  return useLiveQuery(async () => {
    const [settings, assets, prices] = await Promise.all([
      settingsRepo.get(),
      db.assets.toArray().then((all) => all.filter((a) => !a.archivedAt)),
      db.priceCache.toArray(),
      db.fxCache.toArray(), // tracked by liveQuery so portfolio recomputes when FX updates
    ]);
    const priceMap = new Map(prices.map((p) => [p.symbol, p]));
    return buildPortfolioView(assets, settings.baseCurrency, priceMap);
  });
}

export function useSettings() {
  return useLiveQuery(() => settingsRepo.get());
}

export function useFxLatest(): FxCacheRow | undefined {
  return useLiveQuery(async () => {
    const rows = await db.fxCache.toArray();
    if (rows.length === 0) return undefined;
    return rows.reduce((newest, row) =>
      row.fetchedAt > newest.fetchedAt ? row : newest,
    );
  });
}
