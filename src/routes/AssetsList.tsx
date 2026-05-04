import { Link } from 'react-router-dom';
import { CATEGORIES, CATEGORY_BY_KEY, ASSET_TYPE_LABELS } from '../domain/categories';
import { formatCurrency } from '../lib/formatCurrency';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { usePortfolio } from '../state/usePortfolio';
import type { AssetView } from '../domain/portfolio';

export default function AssetsList() {
  const portfolio = usePortfolio();

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  const grouped = CATEGORIES.map((c) => ({
    meta: c,
    items: portfolio.assets.filter((v) => v.asset.category === c.key),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">資產列表</h1>
        <Link
          to="/assets/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + 新增資產
        </Link>
      </div>

      {portfolio.assets.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          還沒有任何資產。點右上角「新增資產」開始記錄。
        </div>
      )}

      {grouped.map(({ meta, items }) =>
        items.length === 0 ? null : (
          <section key={meta.key}>
            <header className="mb-2 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: meta.hex }}
              />
              <h2 className="text-sm font-semibold text-gray-700">{meta.label}</h2>
              <span className="text-xs text-gray-400">{items.length} 筆</span>
            </header>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2">名稱</th>
                    <th className="px-4 py-2">類型</th>
                    <th className="px-4 py-2 text-right">原幣金額</th>
                    <th className="px-4 py-2 text-right">換算</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((view) => (
                    <AssetRow key={view.asset.id} view={view} base={portfolio.base} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}
    </div>
  );
}

function AssetRow({ view, base }: { view: AssetView; base: string }) {
  const { asset, valueInAssetCurrency, valueInBase } = view;
  const sign = asset.category === 'liability' ? '-' : '';

  async function handleDelete() {
    if (!asset.id) return;
    const cat = CATEGORY_BY_KEY[asset.category].label;
    if (!confirm(`確定要刪除「${asset.name}」(${cat}) 嗎？`)) return;
    await assetsRepo.remove(asset.id);
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{asset.name}</div>
        {asset.notes && (
          <div className="text-xs text-gray-500">{asset.notes}</div>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {ASSET_TYPE_LABELS[asset.type]}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {sign}
        {formatCurrency(valueInAssetCurrency, asset.currency)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
        {valueInBase === null ? (
          <span className="text-amber-600">無匯率</span>
        ) : asset.currency === base ? (
          <span className="text-gray-300">—</span>
        ) : (
          <>
            {sign}
            {formatCurrency(valueInBase, base)}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/assets/${asset.id}/edit`}
          className="mr-3 text-sm text-gray-600 hover:text-gray-900"
        >
          編輯
        </Link>
        <button
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-700"
        >
          刪除
        </button>
      </td>
    </tr>
  );
}
