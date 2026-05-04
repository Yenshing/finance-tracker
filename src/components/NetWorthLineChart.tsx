import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import clsx from 'clsx';
import type { Snapshot } from '../db/types';
import { CATEGORY_BY_KEY } from '../domain/categories';
import { formatCurrency } from '../lib/formatCurrency';

export type RangeKey = '3M' | '6M' | '1Y' | '5Y' | 'ALL';

const DAYS_BY_RANGE: Record<RangeKey, number | null> = {
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '5Y': 365 * 5,
  ALL: null,
};

const RANGE_LABEL: Record<RangeKey, string> = {
  '3M': '近 3 個月',
  '6M': '近 6 個月',
  '1Y': '近 1 年',
  '5Y': '近 5 年',
  ALL: '全部',
};

interface ChartRow {
  takenAt: number;
  localDate: string;
  liquid: number;
  investment: number;
  fixed: number;
  netWorth: number;
}

interface Props {
  snapshots: Snapshot[];
  base: string;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
}

const SERIES = [
  { key: 'liquid', label: '流動資金', color: CATEGORY_BY_KEY.liquid.hex },
  { key: 'investment', label: '投資', color: CATEGORY_BY_KEY.investment.hex },
  { key: 'fixed', label: '固定資產', color: CATEGORY_BY_KEY.fixed.hex },
  { key: 'netWorth', label: '淨資產', color: '#111827' },
] as const;

export default function NetWorthLineChart({
  snapshots,
  base,
  range,
  onRangeChange,
}: Props) {
  const data = useMemo(() => {
    const matching = snapshots
      .filter((s) => s.baseCurrency === base)
      .map<ChartRow>((s) => ({
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
    const cutoff = Date.now() - days * 86_400_000;
    return matching.filter((row) => row.takenAt >= cutoff);
  }, [snapshots, base, range]);

  const filteredOutCount = snapshots.length - snapshots.filter((s) => s.baseCurrency === base).length;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-700">資產趨勢</h3>
        <span className="text-xs text-gray-400">{data.length} 個快照</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {(Object.keys(DAYS_BY_RANGE) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onRangeChange(key)}
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                range === key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {RANGE_LABEL[key]}
            </button>
          ))}
        </div>
      </header>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-xs text-gray-400">
          {snapshots.length === 0
            ? '尚無歷史資料。每天打開 App、或按「重新整理」會自動拍快照。'
            : '此區間內沒有資料'}
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
            >
              <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
              <XAxis
                dataKey="localDate"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: number) => compactNumber(v)}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                }}
                formatter={(v) =>
                  typeof v === 'number' ? formatCurrency(v, base) : '—'
                }
                labelFormatter={(d) => `${d}`}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={s.key === 'netWorth' ? 2.5 : 1.5}
                  dot={data.length <= 30 ? { r: 2 } : false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {filteredOutCount > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          有 {filteredOutCount} 筆快照使用其他幣別未顯示。
        </p>
      )}
    </section>
  );
}

function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}億`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}萬`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return v.toFixed(0);
}
