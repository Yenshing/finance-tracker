import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../domain/categories';
import { useFormatMoney } from '../state/useAmountFormat';
import { useFxLatest, usePortfolio } from '../state/usePortfolio';
import { useRefreshPrices } from '../state/useRefreshPrices';
import { useSnapshots } from '../state/useSnapshots';
import AllocationDonut, { type DonutSlice } from '../components/AllocationDonut';
import CategoryCard from '../components/CategoryCard';
import StockTreemap from '../components/StockTreemap';
import NetWorthLineChart, {
  type RangeKey,
} from '../components/NetWorthLineChart';
import InvestmentTrendChart from '../components/InvestmentTrendChart';
import {
  INVESTMENT_BUCKETS,
  bucketInvestmentTotals,
} from '../domain/investmentBuckets';

type ExpandableBucket = 'us_stock' | 'tw_stock';
const EXPANDABLE: ReadonlySet<string> = new Set(['us_stock', 'tw_stock']);

export default function Dashboard() {
  const portfolio = usePortfolio();
  const fx = useFxLatest();
  const snapshots = useSnapshots();
  const fmt = useFormatMoney();
  const { loading, errors, refresh } = useRefreshPrices();
  const [expanded, setExpanded] = useState<ExpandableBucket | null>(null);
  const [range, setRange] = useState<RangeKey>('6M');
  const [investmentRange, setInvestmentRange] = useState<RangeKey>('6M');

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

  const investmentTotals = bucketInvestmentTotals(portfolio.assets);
  const investmentSlices: DonutSlice[] = INVESTMENT_BUCKETS.map((b) => ({
    key: b.key,
    name: b.label,
    value: investmentTotals[b.key],
    color: b.color,
  }));

  const usStockItems = portfolio.assets.filter(
    (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker !== 'tw_broker',
  );
  const twStockItems = portfolio.assets.filter(
    (v) =>
      v.asset.category === 'investment' &&
      v.asset.type === 'stock' &&
      v.asset.broker === 'tw_broker',
  );

  const expandedMeta =
    expanded === 'us_stock'
      ? INVESTMENT_BUCKETS.find((b) => b.key === 'us_stock')!
      : expanded === 'tw_stock'
        ? INVESTMENT_BUCKETS.find((b) => b.key === 'tw_stock')!
        : null;
  const expandedItems =
    expanded === 'us_stock'
      ? usStockItems
      : expanded === 'tw_stock'
        ? twStockItems
        : [];

  function handleInvestmentSliceClick(key: string) {
    if (!EXPANDABLE.has(key)) return;
    setExpanded((prev) => (prev === key ? null : (key as ExpandableBucket)));
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
        <div className="space-y-1 text-xs">
          {portfolio.unconvertibleCount > 0 && (
            <div className="inline-block rounded bg-amber-100 px-2 py-1 text-amber-800">
              有 {portfolio.unconvertibleCount} 筆資產缺少匯率資料未計入。請按「更新報價」。
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
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <AllocationDonut
              title="資產分類"
              data={categorySlices}
              base={portfolio.base}
            />
            <AllocationDonut
              title="投資組合"
              data={investmentSlices}
              base={portfolio.base}
              emptyMessage="尚無投資資料"
              onSliceClick={handleInvestmentSliceClick}
              isClickable={(key) => EXPANDABLE.has(key)}
              selectedKey={expanded}
            />
          </section>

          {expandedMeta && (
            <StockTreemap
              title={expandedMeta.label}
              color={expandedMeta.color}
              items={expandedItems}
              base={portfolio.base}
              onClose={() => setExpanded(null)}
            />
          )}

          <NetWorthLineChart
            snapshots={snapshots ?? []}
            base={portfolio.base}
            range={range}
            onRangeChange={setRange}
          />

          <InvestmentTrendChart
            snapshots={snapshots ?? []}
            base={portfolio.base}
            range={investmentRange}
            onRangeChange={setInvestmentRange}
          />

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
