import { Link } from 'react-router-dom';
import { CATEGORIES } from '../domain/categories';
import { formatCurrency } from '../lib/formatCurrency';
import { usePortfolio } from '../state/usePortfolio';
import AllocationTreemap from '../components/AllocationTreemap';
import CategoryCard from '../components/CategoryCard';

export default function Dashboard() {
  const portfolio = usePortfolio();

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  const isEmpty = portfolio.assets.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <div className="text-sm text-gray-500">淨資產</div>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-gray-900">
          {formatCurrency(portfolio.netWorth, portfolio.base)}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          總資產 {formatCurrency(portfolio.totalAssets, portfolio.base)}
          {portfolio.totalLiabilities > 0 && (
            <>
              {' '}
              / 總負債 {formatCurrency(portfolio.totalLiabilities, portfolio.base)}
            </>
          )}
        </div>
        {portfolio.unconvertibleCount > 0 && (
          <div className="mt-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
            有 {portfolio.unconvertibleCount} 筆資產缺少匯率資料未計入。
          </div>
        )}
      </header>

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

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
