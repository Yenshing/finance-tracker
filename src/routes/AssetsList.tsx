import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CATEGORY_BY_KEY, ASSET_TYPE_LABELS } from '../domain/categories';
import { BROKER_BY_CODE } from '../domain/brokers';
import { CRYPTO_BY_ID } from '../domain/cryptos';
import { formatCurrency } from '../lib/formatCurrency';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { usePortfolio } from '../state/usePortfolio';
import type { AssetView } from '../domain/portfolio';

type SortMode = 'value_desc' | 'name_asc';
type UsBrokerFilter = 'all' | 'sub_broker' | 'overseas';

const liquidMeta = CATEGORY_BY_KEY.liquid;
const investmentMeta = CATEGORY_BY_KEY.investment;
const fixedMeta = CATEGORY_BY_KEY.fixed;

const isUsStock = (v: AssetView) =>
  v.asset.type === 'stock' && v.asset.broker !== 'tw_broker';
const isTwStock = (v: AssetView) =>
  v.asset.type === 'stock' && v.asset.broker === 'tw_broker';
const isCrypto = (v: AssetView) => v.asset.type === 'crypto';
const isOtherInvestment = (v: AssetView) =>
  v.asset.category === 'investment' && v.asset.type === 'custom';

export default function AssetsList() {
  const portfolio = usePortfolio();
  const [sort, setSort] = useState<SortMode>('value_desc');
  const [usBrokerFilter, setUsBrokerFilter] = useState<UsBrokerFilter>('all');

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  function sortItems(items: AssetView[]): AssetView[] {
    const copy = [...items];
    if (sort === 'value_desc') {
      copy.sort(
        (a, b) => (b.valueInBase ?? -Infinity) - (a.valueInBase ?? -Infinity),
      );
    } else {
      copy.sort((a, b) => a.asset.name.localeCompare(b.asset.name, 'zh-TW'));
    }
    return copy;
  }

  const liquidItems = sortItems(
    portfolio.assets.filter((v) => v.asset.category === 'liquid'),
  );
  const fixedItems = sortItems(
    portfolio.assets.filter((v) => v.asset.category === 'fixed'),
  );
  const investmentItems = portfolio.assets.filter(
    (v) => v.asset.category === 'investment',
  );

  const allUsStocks = sortItems(investmentItems.filter(isUsStock));
  const visibleUsStocks =
    usBrokerFilter === 'all'
      ? allUsStocks
      : allUsStocks.filter((v) => v.asset.broker === usBrokerFilter);
  const twStocks = sortItems(investmentItems.filter(isTwStock));
  const cryptos = sortItems(investmentItems.filter(isCrypto));
  const others = sortItems(investmentItems.filter(isOtherInvestment));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">資產列表</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">排序</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="value_desc">金額大小</option>
            <option value="name_asc">名稱</option>
          </select>
          <Link
            to="/assets/new"
            className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + 新增資產
          </Link>
        </div>
      </div>

      {portfolio.assets.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          還沒有任何資產。點右上角「新增資產」開始記錄。
        </div>
      )}

      {liquidItems.length > 0 && (
        <CategoryBlock
          color={liquidMeta.hex}
          label={liquidMeta.label}
          count={liquidItems.length}
        >
          <AssetTable
            items={liquidItems}
            base={portfolio.base}
            totalAssets={portfolio.totalAssets}
          />
        </CategoryBlock>
      )}

      {investmentItems.length > 0 && (
        <CategoryBlock
          color={investmentMeta.hex}
          label={investmentMeta.label}
          count={investmentItems.length}
        >
          <div className="space-y-4">
            {allUsStocks.length > 0 && (
              <SubBlock
                title="美元股票"
                count={allUsStocks.length}
                trailing={
                  <UsBrokerChips
                    value={usBrokerFilter}
                    onChange={setUsBrokerFilter}
                  />
                }
              >
                {visibleUsStocks.length === 0 ? (
                  <EmptyFilterPlaceholder />
                ) : (
                  <AssetTable
                    items={visibleUsStocks}
                    base={portfolio.base}
                    totalAssets={portfolio.totalAssets}
                  />
                )}
              </SubBlock>
            )}
            {twStocks.length > 0 && (
              <SubBlock title="台灣股票" count={twStocks.length}>
                <AssetTable
                  items={twStocks}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </SubBlock>
            )}
            {cryptos.length > 0 && (
              <SubBlock title="加密貨幣" count={cryptos.length}>
                <AssetTable
                  items={cryptos}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </SubBlock>
            )}
            {others.length > 0 && (
              <SubBlock title="其他" count={others.length}>
                <AssetTable
                  items={others}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </SubBlock>
            )}
          </div>
        </CategoryBlock>
      )}

      {fixedItems.length > 0 && (
        <CategoryBlock
          color={fixedMeta.hex}
          label={fixedMeta.label}
          count={fixedItems.length}
        >
          <AssetTable
            items={fixedItems}
            base={portfolio.base}
            totalAssets={portfolio.totalAssets}
          />
        </CategoryBlock>
      )}
    </div>
  );
}

function CategoryBlock({
  color,
  label,
  count,
  children,
}: {
  color: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
        <span className="text-xs text-gray-400">{count} 筆</span>
      </header>
      {children}
    </section>
  );
}

function SubBlock({
  title,
  count,
  trailing,
  children,
}: {
  title: string;
  count: number;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
        <span className="text-xs text-gray-400">{count} 筆</span>
        {trailing && <div className="ml-auto">{trailing}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyFilterPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-400">
      目前篩選條件下沒有資料
    </div>
  );
}

function UsBrokerChips({
  value,
  onChange,
}: {
  value: UsBrokerFilter;
  onChange: (next: UsBrokerFilter) => void;
}) {
  const chips: { key: UsBrokerFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'sub_broker', label: '複委託' },
    { key: 'overseas', label: '海外券商' },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
            value === key
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AssetTable({
  items,
  base,
  totalAssets,
}: {
  items: AssetView[];
  base: string;
  totalAssets: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-2">名稱</th>
            <th className="px-4 py-2">明細</th>
            <th className="px-4 py-2 text-right">原幣金額</th>
            <th className="px-4 py-2 text-right">換算</th>
            <th className="px-4 py-2 text-right">佔比</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((view) => (
            <AssetRow
              key={view.asset.id}
              view={view}
              base={base}
              totalAssets={totalAssets}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetRow({
  view,
  base,
  totalAssets,
}: {
  view: AssetView;
  base: string;
  totalAssets: number;
}) {
  const { asset, valueInAssetCurrency, valueInBase, pricedAt, stale } = view;
  const isStock = asset.type === 'stock' && asset.symbol;
  const isCryptoRow = asset.type === 'crypto' && asset.symbol;
  const broker = asset.broker ? BROKER_BY_CODE[asset.broker] : null;
  const crypto = isCryptoRow ? CRYPTO_BY_ID[asset.symbol!] : null;
  const pct =
    valueInBase !== null && totalAssets > 0
      ? (valueInBase / totalAssets) * 100
      : null;

  async function handleDelete() {
    if (!asset.id) return;
    const cat = CATEGORY_BY_KEY[asset.category].label;
    if (!confirm(`確定要刪除「${asset.name}」(${cat}) 嗎？`)) return;
    await assetsRepo.remove(asset.id);
  }

  let detail: React.ReactNode;
  if (isStock) {
    detail = (
      <div className="text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="font-mono">{asset.symbol}</span>
          {broker && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
              {broker.label}
            </span>
          )}
        </div>
        <div>
          {asset.quantity} 股
          {valueInAssetCurrency > 0 && asset.quantity ? (
            <>
              {' × '}
              {formatCurrency(valueInAssetCurrency / asset.quantity, asset.currency)}
            </>
          ) : null}
        </div>
        {pricedAt && (
          <div className="text-gray-400">
            報價：{new Date(pricedAt).toLocaleString('zh-TW')}
          </div>
        )}
        {stale && <div className="text-amber-600">尚未抓價</div>}
      </div>
    );
  } else if (isCryptoRow) {
    detail = (
      <div className="text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="font-mono">{crypto?.symbol ?? asset.symbol}</span>
        </div>
        <div>
          {asset.quantity}
          {valueInAssetCurrency > 0 && asset.quantity ? (
            <>
              {' × '}
              {formatCurrency(valueInAssetCurrency / asset.quantity, 'USD')}
            </>
          ) : null}
        </div>
        {pricedAt && (
          <div className="text-gray-400">
            報價：{new Date(pricedAt).toLocaleString('zh-TW')}
          </div>
        )}
        {stale && <div className="text-amber-600">尚未抓價</div>}
      </div>
    );
  } else {
    detail = <span className="text-gray-600">{ASSET_TYPE_LABELS[asset.type]}</span>;
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-gray-900">{asset.name}</div>
        {asset.notes && (
          <div className="text-xs text-gray-500">{asset.notes}</div>
        )}
      </td>
      <td className="px-4 py-3 align-top">{detail}</td>
      <td className="px-4 py-3 align-top text-right tabular-nums">
        {formatCurrency(valueInAssetCurrency, asset.currency)}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums text-gray-600">
        {valueInBase === null ? (
          <span className="text-amber-600">無匯率</span>
        ) : asset.currency === base ? (
          <span className="text-gray-300">—</span>
        ) : (
          formatCurrency(valueInBase, base)
        )}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums text-gray-600">
        {pct === null ? <span className="text-gray-300">—</span> : `${pct.toFixed(1)}%`}
      </td>
      <td className="px-4 py-3 text-right align-top">
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
