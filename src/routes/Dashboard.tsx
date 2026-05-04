import { Link } from 'react-router-dom';
import { CATEGORIES } from '../domain/categories';
import { formatCurrency } from '../lib/formatCurrency';
import { useFxLatest, usePortfolio } from '../state/usePortfolio';
import { useRefreshPrices } from '../state/useRefreshPrices';
import AllocationTreemap from '../components/AllocationTreemap';
import CategoryCard from '../components/CategoryCard';

export default function Dashboard() {
  const portfolio = usePortfolio();
  const fx = useFxLatest();
  const { loading, errors, refresh } = useRefreshPrices();

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  const isEmpty = portfolio.assets.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">淨資產</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums text-gray-900">
            {formatCurrency(portfolio.netWorth, portfolio.base)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            總資產 {formatCurrency(portfolio.totalAssets, portfolio.base)}
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
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '更新中…' : '重新整理'}
        </button>
      </header>

      {(portfolio.unconvertibleCount > 0 ||
        portfolio.staleCount > 0 ||
        errors.length > 0) && (
        <div className="space-y-1 text-xs">
          {portfolio.unconvertibleCount > 0 && (
            <div className="inline-block rounded bg-amber-100 px-2 py-1 text-amber-800">
              有 {portfolio.unconvertibleCount} 筆資產缺少匯率資料未計入。請按「重新整理」。
            </div>
          )}
          {portfolio.staleCount > 0 && (
            <div className="inline-block rounded bg-amber-100 px-2 py-1 text-amber-800">
              有 {portfolio.staleCount} 筆股票尚未抓價，市值暫顯示為 0。
            </div>
          )}
          {errors.map((err) => (
            <div
              key={err}
              className="inline-block rounded bg-red-100 px-2 py-1 text-red-800"
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
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">
              資產配置（依市值）
            </h2>
            <AllocationTreemap assets={portfolio.assets} base={portfolio.base} />
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CATEGORIES.map((meta) => (
              <CategoryCard
                key={meta.key}
                meta={meta}
                amount={portfolio.byCategory[meta.key]}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                count={
                  portfolio.assets.filter((v) => v.asset.category === meta.key).length
                }
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
