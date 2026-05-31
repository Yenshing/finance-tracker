import { Link } from 'react-router-dom';
import type { CategoryMeta } from '../domain/categories';
import { useFormatMoney } from '../state/useAmountFormat';

interface Props {
  meta: CategoryMeta;
  amount: number;
  base: string;
  count: number;
  topAssetName?: string;
}

export default function CategoryCard({
  meta,
  amount,
  base,
  count,
  topAssetName,
}: Props) {
  const fmt = useFormatMoney();

  return (
    <Link
      to={`/assets#${meta.key}`}
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: meta.hex }}
          />
          <span className="truncate text-sm font-medium text-gray-700">
            {meta.label}
          </span>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{count} 筆 →</span>
      </div>
      <div className="mt-2 truncate text-xl font-semibold tabular-nums text-gray-900">
        {fmt(amount, base)}
      </div>
      {topAssetName && (
        <div className="mt-auto truncate pt-2 text-xs text-gray-500">
          最大：<span className="text-gray-700">{topAssetName}</span>
        </div>
      )}
    </Link>
  );
}
