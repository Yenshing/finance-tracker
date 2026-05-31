import { useFormatMoney } from '../state/useAmountFormat';
import { CATEGORY_BY_KEY } from '../domain/categories';
import {
  INVESTMENT_BUCKET_BY_KEY,
  type InvestmentBucketKey,
} from '../domain/investmentBuckets';
import {
  type CurrencyPool,
  currencyColor,
} from '../domain/currencyPools';

interface Props {
  title: string;
  pools: CurrencyPool[];
  base: string;
}

const BUCKET_ORDER: InvestmentBucketKey[] = [
  'us_sub_broker',
  'us_overseas',
  'tw_stock',
  'crypto',
  'other',
];

interface Segment {
  key: string;
  label: string;
  color: string;
  value: number;
}

export default function CurrencyPoolBars({ title, pools, base }: Props) {
  const fmt = useFormatMoney();
  const grandTotal = pools.reduce((s, p) => s + p.total, 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-[11px] text-gray-400">
          流動 + 投資，排除固定資產，以 {base} 計
        </span>
      </div>

      {pools.length === 0 ? (
        <div className="mt-3 text-xs text-gray-400">尚無資料</div>
      ) : (
        <ul className="mt-4 space-y-4">
          {pools.map((pool, idx) => {
            const segments: Segment[] = [];
            if (pool.liquid > 0) {
              segments.push({
                key: 'liquid',
                label: '流動資金',
                color: CATEGORY_BY_KEY.liquid.hex,
                value: pool.liquid,
              });
            }
            for (const bk of BUCKET_ORDER) {
              const v = pool.byBucket[bk];
              if (v > 0) {
                const meta = INVESTMENT_BUCKET_BY_KEY[bk];
                segments.push({
                  key: bk,
                  label: meta.label,
                  color: meta.color,
                  value: v,
                });
              }
            }
            const poolPct =
              grandTotal > 0 ? (pool.total / grandTotal) * 100 : 0;
            return (
              <li key={pool.currency}>
                <div className="flex items-baseline justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: currencyColor(pool.currency, idx) }}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {pool.currency}
                    </span>
                    <span className="text-gray-400">
                      佔總池 {poolPct.toFixed(1)}%
                    </span>
                  </div>
                  <span className="tabular-nums text-gray-900">
                    {fmt(pool.total, base)}
                  </span>
                </div>
                <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded bg-gray-100">
                  {segments.map((seg) => {
                    const width = (seg.value / pool.total) * 100;
                    return (
                      <div
                        key={seg.key}
                        title={`${seg.label}：${fmt(seg.value, base)} (${width.toFixed(1)}%)`}
                        style={{
                          width: `${width}%`,
                          background: seg.color,
                        }}
                      />
                    );
                  })}
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
                  {segments.map((seg) => {
                    const width = (seg.value / pool.total) * 100;
                    return (
                      <li
                        key={seg.key}
                        className="flex items-center gap-1.5"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ background: seg.color }}
                        />
                        <span>{seg.label}</span>
                        <span className="tabular-nums text-gray-400">
                          {width.toFixed(1)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
