import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { buildPortfolioView, type PortfolioView } from '../domain/portfolio';

export function usePortfolio(): PortfolioView | undefined {
  return useLiveQuery(async () => {
    const [settings, assets] = await Promise.all([
      settingsRepo.get(),
      db.assets.toArray().then((all) => all.filter((a) => !a.archivedAt)),
    ]);
    return buildPortfolioView(assets, settings.baseCurrency);
  });
}

export function useSettings() {
  return useLiveQuery(() => settingsRepo.get());
}
