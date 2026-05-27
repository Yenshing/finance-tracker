import { useMemo } from 'react';
import type { Snapshot } from '../db/types';
import {
  INVESTMENT_BUCKET_BY_KEY,
  type InvestmentBucketKey,
} from '../domain/investmentBuckets';
import TrendLineChart, {
  type TrendRow,
  type TrendSeries,
} from './TrendLineChart';
import { DAYS_BY_RANGE, type RangeKey } from './trendRange';

interface Props {
  bucketKey: InvestmentBucketKey;
  snapshots: Snapshot[];
  base: string;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
}

export default function InvestmentTrendChart({
  bucketKey,
  snapshots,
  base,
  range,
  onRangeChange,
}: Props) {
  const meta = INVESTMENT_BUCKET_BY_KEY[bucketKey];
  const series: TrendSeries[] = useMemo(
    () => [{ key: 'value', label: meta.label, color: meta.color, emphasis: true }],
    [meta.label, meta.color],
  );

  const { data, hasBucketHistory } = useMemo(() => {
    const matching = snapshots
      .filter((s) => s.baseCurrency === base)
      .map<TrendRow>((s) => ({
        takenAt: s.takenAt,
        localDate: s.localDate,
        // undefined leaves a gap for snapshots taken before the schema
        // upgrade (instead of plotting a misleading 0).
        value: s.byInvestmentBucket?.[bucketKey],
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
  }, [snapshots, base, range, bucketKey]);

  const filteredOutCount =
    snapshots.length - snapshots.filter((s) => s.baseCurrency === base).length;

  const footnoteParts: string[] = [];
  if (!hasBucketHistory && data.length > 0) {
    footnoteParts.push('此類別的歷史拆分將在下一次快照後開始累積。');
  }
  if (filteredOutCount > 0) {
    footnoteParts.push(`有 ${filteredOutCount} 筆快照使用其他幣別未顯示。`);
  }

  return (
    <TrendLineChart
      title={`${meta.label}趨勢`}
      data={data}
      series={series}
      base={base}
      range={range}
      onRangeChange={onRangeChange}
      emptyMessage={
        snapshots.length === 0
          ? '尚無歷史資料。每天打開 App、或按「更新報價」會自動拍快照。'
          : '此區間內沒有資料'
      }
      footnote={footnoteParts.length > 0 ? footnoteParts.join(' ') : undefined}
      yAxisFit="data"
    />
  );
}
