import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import type { AssetView } from '../domain/portfolio';
import {
  HIDDEN,
  useAmountsHidden,
  useFormatMoney,
} from '../state/useAmountFormat';

interface Props {
  title: string;
  color: string;
  items: AssetView[];
  base: string;
  onClose: () => void;
}

interface Node {
  name: string;
  symbol: string;
  quantity: number;
  size: number;
  pct: number;
  fill: string;
  originalValue: number;
  currency: string;
  [key: string]: string | number;
}

export default function StockTreemap({ title, color, items, base, onClose }: Props) {
  const hidden = useAmountsHidden();
  const fmt = useFormatMoney();
  const visible = items
    .filter((v) => v.valueInBase !== null && v.valueInBase > 0)
    .sort((a, b) => (b.valueInBase ?? 0) - (a.valueInBase ?? 0));

  const total = visible.reduce((s, v) => s + (v.valueInBase ?? 0), 0);

  const data: Node[] = visible.map((v) => ({
    name: v.asset.name,
    symbol: v.asset.symbol ?? '',
    quantity: v.asset.quantity ?? 0,
    size: v.valueInBase ?? 0,
    pct: total > 0 ? ((v.valueInBase ?? 0) / total) * 100 : 0,
    fill: color,
    originalValue: v.valueInAssetCurrency,
    currency: v.asset.currency,
  }));

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: color }}
        />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">{visible.length} 檔</span>
        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {fmt(total, base)}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            收起
          </button>
        </span>
      </header>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-gray-400">
          沒有可顯示的持股
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data}
              dataKey="size"
              stroke="#fff"
              isAnimationActive={false}
              content={<TreemapCell />}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const node = payload[0].payload as Node;
                  return (
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-500">{node.symbol}</span>
                        <span className="font-semibold text-gray-900">{node.name}</span>
                      </div>
                      <div className="text-gray-500">
                        {hidden ? HIDDEN : node.quantity} 股 · {node.pct.toFixed(1)}%
                      </div>
                      <div className="mt-1 text-gray-700">
                        {fmt(node.originalValue, node.currency)}
                        {node.currency !== base && (
                          <span className="text-gray-400">
                            {' '}
                            ≈ {fmt(node.size, base)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  name?: string;
  symbol?: string;
  pct?: number;
}

function TreemapCell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0, fill, name, symbol, pct } = props;
  const pctText = pct !== undefined ? `${pct.toFixed(pct < 1 ? 1 : 0)}%` : '';
  const fitsThreeLines = width >= 110 && height >= 56;
  const fitsTwoLines = !fitsThreeLines && width >= 80 && height >= 36;
  const fitsPctOnly = !fitsThreeLines && !fitsTwoLines && width >= 38 && height >= 18;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
      />
      {fitsThreeLines && (
        <>
          <text
            x={x + 8}
            y={y + 18}
            fill="#fff"
            fontSize={12}
            fontFamily="ui-monospace, monospace"
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {symbol}
          </text>
          <text
            x={x + 8}
            y={y + 34}
            fill="rgba(255,255,255,0.92)"
            fontSize={11}
            style={{ pointerEvents: 'none' }}
          >
            {name}
          </text>
          <text
            x={x + 8}
            y={y + 50}
            fill="rgba(255,255,255,0.85)"
            fontSize={11}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {pctText}
          </text>
        </>
      )}
      {fitsTwoLines && (
        <>
          <text
            x={x + 8}
            y={y + 18}
            fill="#fff"
            fontSize={12}
            fontFamily="ui-monospace, monospace"
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {symbol}
          </text>
          <text
            x={x + 8}
            y={y + 32}
            fill="rgba(255,255,255,0.85)"
            fontSize={11}
            style={{ pointerEvents: 'none' }}
          >
            {pctText}
          </text>
        </>
      )}
      {fitsPctOnly && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 4}
          fill="#fff"
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {pctText}
        </text>
      )}
    </g>
  );
}
