import { useMemo } from 'react';
import type { Snapshot } from '../db/types';
import { CATEGORY_BY_KEY } from '../domain/categories';
import TrendLineChart, {
  type TrendRow,
  type TrendSeries,
} from './TrendLineChart';
import { DAYS_BY_RANGE, type RangeKey } from './trendRange';

export type { RangeKey } from './trendRange';

interface Props {
  snapshots: Snapshot[];
  base: string;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
}

const SERIES: TrendSeries[] = [
  { key: 'liquid', label: '流動資金', color: CATEGORY_BY_KEY.liquid.hex },
  { key: 'investment', label: '投資', color: CATEGORY_BY_KEY.investment.hex },
  { key: 'fixed', label: '固定資產', color: CATEGORY_BY_KEY.fixed.hex },
  { key: 'netWorth', label: '淨資產', color: '#111827', emphasis: true },
];

export default function NetWorthLineChart({
  snapshots,
  base,
  range,
  onRangeChange,
}: Props) {
  const data = useMemo<TrendRow[]>(() => {
    const matching = snapshots
      .filter((s) => s.baseCurrency === base)
      .map<TrendRow>((s) => ({
        takenAt: s.takenAt,
        localDate: s.localDate,
        liquid: s.byCategory.liquid ?? 0,
        investment: s.byCategory.investment ?? 0,
        fixed: s.byCategory.fixed ?? 0,
        netWorth: s.totalNetWorth,
      }))
      .sort((a, b) => a.takenAt - b.takenAt);

    const days = DAYS_BY_RANGE[range];
    if (days === null) return matching;
    // eslint-disable-next-line react-hooks/purity -- cutoff is intentionally "now"
    const cutoff = Date.now() - days * 86_400_000;
    return matching.filter((row) => row.takenAt >= cutoff);
  }, [snapshots, base, range]);

  const filteredOutCount =
    snapshots.length - snapshots.filter((s) => s.baseCurrency === base).length;

  return (
    <TrendLineChart
      title="資產趨勢"
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
      footnote={
        filteredOutCount > 0
          ? `有 ${filteredOutCount} 筆快照使用其他幣別未顯示。`
          : undefined
      }
    />
  );
}
