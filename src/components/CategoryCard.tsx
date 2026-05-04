import type { CategoryMeta } from '../domain/categories';
import { formatCurrency } from '../lib/formatCurrency';

interface Props {
  meta: CategoryMeta;
  amount: number;
  base: string;
  totalAssets: number;
  count: number;
}

export default function CategoryCard({ meta, amount, base, totalAssets, count }: Props) {
  const pct = totalAssets > 0 ? (amount / totalAssets) * 100 : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.hex }} />
        <span className="text-sm font-medium text-gray-700">{meta.label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-gray-900">
        {formatCurrency(amount, base)}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{count} 筆</span>
        {pct !== null && <span>{pct.toFixed(1)}%</span>}
      </div>
    </div>
  );
}
