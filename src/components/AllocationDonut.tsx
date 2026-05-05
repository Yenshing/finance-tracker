import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import clsx from 'clsx';
import { useFormatMoney } from '../state/useAmountFormat';

const CHART_SIZE = 176;

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  data: DonutSlice[];
  base: string;
  emptyMessage?: string;
  onSliceClick?: (key: string) => void;
  isClickable?: (key: string) => boolean;
  selectedKey?: string | null;
}

export default function AllocationDonut({
  title,
  data,
  base,
  emptyMessage,
  onSliceClick,
  isClickable,
  selectedKey,
}: Props) {
  const fmt = useFormatMoney();
  const total = data.reduce((s, d) => s + d.value, 0);
  const slices = data.filter((d) => d.value > 0);

  function handleClick(key: string) {
    if (!onSliceClick) return;
    if (isClickable && !isClickable(key)) return;
    onSliceClick(key);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {onSliceClick && (
          <span className="text-[10px] text-gray-400">點擊切片或圖例展開</span>
        )}
      </div>
      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div
          className="relative shrink-0"
          style={{ width: CHART_SIZE, height: CHART_SIZE }}
        >
          {slices.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              {emptyMessage ?? '尚無資料'}
            </div>
          ) : (
            <>
              <PieChart width={CHART_SIZE} height={CHART_SIZE}>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                  onClick={(slice: unknown) => {
                    const k = (slice as DonutSlice | undefined)?.key;
                    if (k) handleClick(k);
                  }}
                >
                  {slices.map((d) => {
                    const clickable =
                      onSliceClick && (!isClickable || isClickable(d.key));
                    return (
                      <Cell
                        key={d.key}
                        fill={d.color}
                        opacity={
                          selectedKey && selectedKey !== d.key ? 0.45 : 1
                        }
                        style={{ cursor: clickable ? 'pointer' : 'default' }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const slice = payload[0].payload as DonutSlice;
                    const pct = total > 0 ? (slice.value / total) * 100 : 0;
                    return (
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                        <div className="font-semibold text-gray-900">{slice.name}</div>
                        <div className="text-gray-700">
                          {fmt(slice.value, base)}
                          <span className="ml-1 text-gray-400">
                            ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[10px] text-gray-400">合計</div>
                <div className="text-sm font-semibold tabular-nums text-gray-900">
                  {fmt(total, base)}
                </div>
              </div>
            </>
          )}
        </div>

        <ul className="flex-1 space-y-1.5 self-stretch text-sm">
          {data.map((d) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            const clickable =
              !!onSliceClick && (!isClickable || isClickable(d.key)) && d.value > 0;
            const dim = !!selectedKey && selectedKey !== d.key;
            return (
              <li
                key={d.key}
                onClick={clickable ? () => handleClick(d.key) : undefined}
                className={clsx(
                  'flex items-center gap-2 rounded px-1 py-0.5',
                  clickable && 'cursor-pointer hover:bg-gray-100',
                  dim && 'opacity-50',
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: d.color }}
                />
                <span className="text-gray-700">{d.name}</span>
                <span className="ml-auto tabular-nums text-gray-500">
                  {pct.toFixed(1)}%
                </span>
                <span className="w-24 text-right tabular-nums text-gray-900">
                  {fmt(d.value, base)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
