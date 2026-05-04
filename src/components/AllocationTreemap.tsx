import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import type { AssetView } from '../domain/portfolio';
import { CATEGORY_BY_KEY } from '../domain/categories';
import { formatCurrency } from '../lib/formatCurrency';

interface Props {
  assets: AssetView[];
  base: string;
}

interface Node {
  name: string;
  size: number;
  pct: number;
  fill: string;
  category: string;
  currency: string;
  originalValue: number;
  [key: string]: string | number;
}

export default function AllocationTreemap({ assets, base }: Props) {
  const visible = assets
    .filter((v) => v.valueInBase !== null && v.valueInBase > 0)
    .sort((a, b) => (b.valueInBase ?? 0) - (a.valueInBase ?? 0));
  const total = visible.reduce((s, v) => s + (v.valueInBase ?? 0), 0);

  const data: Node[] = visible.map((v) => ({
    name: v.asset.name,
    size: v.valueInBase ?? 0,
    pct: total > 0 ? ((v.valueInBase ?? 0) / total) * 100 : 0,
    fill: CATEGORY_BY_KEY[v.asset.category].hex,
    category: CATEGORY_BY_KEY[v.asset.category].label,
    currency: v.asset.currency,
    originalValue: v.valueInAssetCurrency,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-400">
        尚無可顯示的資產配置
      </div>
    );
  }

  return (
    <div className="h-72 rounded-lg border border-gray-200 bg-white p-2">
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
                  <div className="font-semibold text-gray-900">{node.name}</div>
                  <div className="text-gray-500">
                    {node.category} · {node.pct.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-gray-700">
                    {formatCurrency(node.originalValue, node.currency)}
                    {node.currency !== base && (
                      <span className="text-gray-400">
                        {' '}
                        ≈ {formatCurrency(node.size, base)}
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
  );
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  name?: string;
  pct?: number;
}

function TreemapCell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0, fill, name, pct } = props;
  const pctText = pct !== undefined ? `${pct.toFixed(pct < 1 ? 1 : 0)}%` : '';
  const fitsName = width >= 90 && height >= 38 && name;
  const fitsPctOnly = !fitsName && width >= 38 && height >= 18 && pctText;

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
      {fitsName && (
        <>
          <text
            x={x + 8}
            y={y + 18}
            fill="#fff"
            fontSize={12}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {name}
          </text>
          <text
            x={x + 8}
            y={y + 34}
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
          fontWeight={500}
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {pctText}
        </text>
      )}
    </g>
  );
}
