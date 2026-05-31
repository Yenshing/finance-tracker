import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFormatMoney } from '../state/useAmountFormat';
import { usePortfolio } from '../state/usePortfolio';
import { useSnapshots } from '../state/useSnapshots';
import AllocationDonut, { type DonutSlice } from '../components/AllocationDonut';
import StockTreemap from '../components/StockTreemap';
import InvestmentTrendChart from '../components/InvestmentTrendChart';
import CurrencyPoolBars from '../components/CurrencyPoolBars';
import {
  INVESTMENT_BUCKETS,
  INVESTMENT_BUCKET_BY_KEY,
  bucketInvestmentTotals,
  type InvestmentBucketKey,
} from '../domain/investmentBuckets';
import { computeCurrencyPools } from '../domain/currencyPools';
import { type RangeKey } from '../components/trendRange';

const BUCKET_PARAM = 'bucket';

function isBucketKey(v: string | null): v is InvestmentBucketKey {
  return v !== null && v in INVESTMENT_BUCKET_BY_KEY;
}

/**
 * Pick a sensible default trend range based on snapshot span — if we have
 * less than 90 days of data, 6M would look mostly empty, so fall back to ALL.
 */
function defaultRangeForSpan(snapshotSpanMs: number): RangeKey {
  const day = 86_400_000;
  if (snapshotSpanMs < 90 * day) return 'ALL';
  return '6M';
}

export default function Investments() {
  const portfolio = usePortfolio();
  const snapshots = useSnapshots();
  const fmt = useFormatMoney();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userRange, setUserRange] = useState<RangeKey | null>(null);

  const rawBucket = searchParams.get(BUCKET_PARAM);
  const selected: InvestmentBucketKey | null = isBucketKey(rawBucket)
    ? rawBucket
    : null;

  const defaultRange = useMemo<RangeKey>(() => {
    if (!snapshots || snapshots.length < 2) return 'ALL';
    const first = snapshots[0].takenAt;
    const last = snapshots[snapshots.length - 1].takenAt;
    return defaultRangeForSpan(last - first);
  }, [snapshots]);

  const range = userRange ?? defaultRange;

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  const investmentTotals = bucketInvestmentTotals(portfolio.assets);
  const totalInvestment = INVESTMENT_BUCKETS.reduce(
    (s, b) => s + investmentTotals[b.key],
    0,
  );
  const investmentSlices: DonutSlice[] = INVESTMENT_BUCKETS.map((b) => ({
    key: b.key,
    name: b.label,
    value: investmentTotals[b.key],
    color: b.color,
  }));

  const currencyPools = computeCurrencyPools(portfolio.assets);

  const selectedMeta = selected ? INVESTMENT_BUCKET_BY_KEY[selected] : null;
  const selectedItems =
    selected && selectedMeta?.hasTreemap
      ? portfolio.assets.filter((v) => selectedMeta.match(v))
      : [];

  function handleSliceClick(key: string) {
    if (!(key in INVESTMENT_BUCKET_BY_KEY)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get(BUCKET_PARAM) === key) {
          next.delete(BUCKET_PARAM);
        } else {
          next.set(BUCKET_PARAM, key);
        }
        return next;
      },
      { replace: true },
    );
  }

  function clearSelection() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(BUCKET_PARAM);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-sm text-gray-500">投資合計</div>
        <div className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">
          {fmt(totalInvestment, portfolio.base)}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AllocationDonut
          title="投資組合"
          data={investmentSlices}
          base={portfolio.base}
          emptyMessage="尚無投資資料"
          onSliceClick={handleSliceClick}
          isClickable={(key) => key in INVESTMENT_BUCKET_BY_KEY}
          selectedKey={selected}
          totalLabel="投資合計"
        />
        <CurrencyPoolBars
          title="幣別池內部組成"
          pools={currencyPools}
          base={portfolio.base}
        />
      </section>

      {selectedMeta && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {selectedMeta.hasTreemap && (
            <StockTreemap
              title={selectedMeta.label}
              color={selectedMeta.color}
              items={selectedItems}
              base={portfolio.base}
              onClose={clearSelection}
            />
          )}
          <InvestmentTrendChart
            bucketKey={selectedMeta.key}
            snapshots={snapshots ?? []}
            base={portfolio.base}
            range={range}
            onRangeChange={setUserRange}
          />
        </section>
      )}
    </div>
  );
}
