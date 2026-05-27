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
import { HIDDEN, useAmountsHidden, useFormatMoney } from '../state/useAmountFormat';
import { DAYS_BY_RANGE, RANGE_LABEL, type RangeKey } from './trendRange';

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  /** Thicker stroke for headline lines like 淨資產 or 投資合計. */
  emphasis?: boolean;
}

export interface TrendRow {
  takenAt: number;
  localDate: string;
  [seriesKey: string]: number | string | null | undefined;
}

interface Props {
  title: string;
  /** Pre-filtered, sorted rows. The chart only renders what it gets. */
  data: TrendRow[];
  series: TrendSeries[];
  base: string;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
  emptyMessage: string;
  /** Small note shown below the chart (e.g. for filtered-out snapshots). */
  footnote?: string;
  /**
   * Y-axis fit mode. 'zero' (default) anchors the bottom of the axis at 0 so
   * categories of different magnitudes can be compared. 'data' lets Recharts
   * auto-fit min/max to the visible data — use when a single series's slope
   * would otherwise be flattened by a wide 0-based range.
   */
  yAxisFit?: 'zero' | 'data';
}

export default function TrendLineChart({
  title,
  data,
  series,
  base,
  range,
  onRangeChange,
  emptyMessage,
  footnote,
  yAxisFit = 'zero',
}: Props) {
  const hidden = useAmountsHidden();
  const fmt = useFormatMoney();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
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
          {emptyMessage}
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
                dataKey="takenAt"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={formatAxisDate}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: number) =>
                  hidden ? HIDDEN : compactNumber(v)
                }
                width={56}
                domain={yAxisFit === 'data' ? ['auto', 'auto'] : [0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                }}
                formatter={(v) =>
                  typeof v === 'number' ? fmt(v, base) : '—'
                }
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as TrendRow | undefined;
                  return row?.localDate ?? '';
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={s.emphasis ? 2.5 : 1.5}
                  dot={data.length <= 30 ? { r: 2 } : false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {footnote && (
        <p className="mt-2 text-[11px] text-gray-400">{footnote}</p>
      )}
    </section>
  );
}

function formatAxisDate(t: number): string {
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}億`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}萬`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return v.toFixed(0);
}
