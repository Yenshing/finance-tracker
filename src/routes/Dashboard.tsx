import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../domain/categories';
import { useFormatMoney } from '../state/useAmountFormat';
import { useFxLatest, usePortfolio } from '../state/usePortfolio';
import { useRefreshPrices } from '../state/useRefreshPrices';
import { useSnapshots } from '../state/useSnapshots';
import AllocationDonut, { type DonutSlice } from '../components/AllocationDonut';
import CategoryCard from '../components/CategoryCard';
import NetWorthLineChart, {
  type RangeKey,
} from '../components/NetWorthLineChart';

export default function Dashboard() {
  const portfolio = usePortfolio();
  const fx = useFxLatest();
  const snapshots = useSnapshots();
  const fmt = useFormatMoney();
  const { loading, errors, refresh } = useRefreshPrices();
  const [range, setRange] = useState<RangeKey>('6M');

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  const isEmpty = portfolio.assets.length === 0;

  const categorySlices: DonutSlice[] = CATEGORIES.map((meta) => ({
    key: meta.key,
    name: meta.label,
    value: portfolio.byCategory[meta.key],
    color: meta.hex,
  }));

  const topByCategory: Record<string, { name: string; value: number }> = {};
  for (const view of portfolio.assets) {
    if (view.valueInBase === null) continue;
    const cat = view.asset.category;
    const current = topByCategory[cat];
    if (!current || view.valueInBase > current.value) {
      topByCategory[cat] = { name: view.asset.name, value: view.valueInBase };
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">淨資產</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums text-gray-900">
            {fmt(portfolio.netWorth, portfolio.base)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            總資產 {fmt(portfolio.totalAssets, portfolio.base)}
          </div>
          {fx && (
            <div className="mt-1 text-xs text-gray-400">
              匯率 1 {fx.from} = {fx.rate.toFixed(3)} {fx.to}（{new Date(
                fx.fetchedAt,
              ).toLocaleString('zh-TW')}）
            </div>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          title="重新抓取股票、加密貨幣與匯率"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '更新中…' : '更新報價'}
        </button>
      </header>

      {(portfolio.unconvertibleCount > 0 ||
        portfolio.staleCount > 0 ||
        errors.length > 0) && (
        <div className="flex flex-col items-start gap-1 text-xs">
          {portfolio.unconvertibleCount > 0 && (
            <div className="rounded bg-amber-100 px-2 py-1 text-amber-800">
              有 {portfolio.unconvertibleCount} 筆資產缺少匯率資料未計入。請按「更新報價」。
            </div>
          )}
          {portfolio.staleCount > 0 && (
            <div className="rounded bg-amber-100 px-2 py-1 text-amber-800">
              有 {portfolio.staleCount} 筆股票尚未抓價，市值暫顯示為 0。
            </div>
          )}
          {errors.map((err) => (
            <div
              key={err}
              className="rounded bg-red-100 px-2 py-1 text-red-800"
            >
              {err}
            </div>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-gray-700">還沒有任何資產</div>
          <Link
            to="/assets/new"
            className="mt-3 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            新增第一筆資產
          </Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <AllocationDonut
              title="資產分類"
              data={categorySlices}
              base={portfolio.base}
              totalLabel="總資產"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((meta) => (
                <CategoryCard
                  key={meta.key}
                  meta={meta}
                  amount={portfolio.byCategory[meta.key]}
                  base={portfolio.base}
                  count={
                    portfolio.assets.filter((v) => v.asset.category === meta.key).length
                  }
                  topAssetName={topByCategory[meta.key]?.name}
                />
              ))}
            </div>
          </section>

          <NetWorthLineChart
            snapshots={snapshots ?? []}
            base={portfolio.base}
            range={range}
            onRangeChange={setRange}
          />
        </>
      )}
    </div>
  );
}
