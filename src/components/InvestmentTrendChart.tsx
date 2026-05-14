import { useMemo } from 'react';
import type { Snapshot } from '../db/types';
import { CATEGORY_BY_KEY } from '../domain/categories';
import { INVESTMENT_BUCKETS } from '../domain/investmentBuckets';
import TrendLineChart, {
  type TrendRow,
  type TrendSeries,
} from './TrendLineChart';
import { DAYS_BY_RANGE, type RangeKey } from './trendRange';

interface Props {
  snapshots: Snapshot[];
  base: string;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
}

const US = INVESTMENT_BUCKETS.find((b) => b.key === 'us_stock')!;
const TW = INVESTMENT_BUCKETS.find((b) => b.key === 'tw_stock')!;

const SERIES: TrendSeries[] = [
  { key: 'us_stock', label: US.label, color: US.color },
  { key: 'tw_stock', label: TW.label, color: TW.color },
  {
    key: 'investment',
    label: '投資合計',
    color: CATEGORY_BY_KEY.investment.hex,
    emphasis: true,
  },
];

export default function InvestmentTrendChart({
  snapshots,
  base,
  range,
  onRangeChange,
}: Props) {
  const { data, hasBucketHistory } = useMemo(() => {
    const matching = snapshots
      .filter((s) => s.baseCurrency === base)
      .map<TrendRow>((s) => ({
        takenAt: s.takenAt,
        localDate: s.localDate,
        investment: s.byCategory.investment ?? 0,
        // undefined leaves a gap in the line (rather than a misleading 0)
        // for snapshots taken before the schema upgrade.
        us_stock: s.byInvestmentBucket?.us_stock,
        tw_stock: s.byInvestmentBucket?.tw_stock,
      }))
      .sort((a, b) => a.takenAt - b.takenAt);

    const days = DAYS_BY_RANGE[range];
    const cutoff =
      days === null
        ? -Infinity
        : // eslint-disable-next-line react-hooks/purity -- cutoff is intentionally "now"
          Date.now() - days * 86_400_000;
    const filtered = matching.filter((row) => row.takenAt >= cutoff);
    const hasBuckets = snapshots.some(
      (s) => s.baseCurrency === base && s.byInvestmentBucket !== undefined,
    );
    return { data: filtered, hasBucketHistory: hasBuckets };
  }, [snapshots, base, range]);

  const filteredOutCount =
    snapshots.length - snapshots.filter((s) => s.baseCurrency === base).length;

  const footnoteParts: string[] = [];
  if (!hasBucketHistory && data.length > 0) {
    footnoteParts.push('美股 / 台股拆分將在下一次快照後開始累積。');
  }
  if (filteredOutCount > 0) {
    footnoteParts.push(`有 ${filteredOutCount} 筆快照使用其他幣別未顯示。`);
  }

  return (
    <TrendLineChart
      title="投資趨勢"
      data={data}
      series={SERIES}
      base={base}
      range={range}
      onRangeChange={onRangeChange}
      emptyMessage={
        snapshots.length === 0
          ? '尚無歷史資料。每天打開 App、或按「更新報價」會自動拍快照。'
          : '此區間內沒有資料'
      }
      footnote={footnoteParts.length > 0 ? footnoteParts.join(' ') : undefined}
    />
  );
}
