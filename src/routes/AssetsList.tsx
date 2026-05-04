import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CATEGORY_BY_KEY, ASSET_TYPE_LABELS } from '../domain/categories';
import { BROKER_BY_CODE } from '../domain/brokers';
import { CRYPTO_BY_ID } from '../domain/cryptos';
import { INVESTMENT_BUCKETS } from '../domain/investmentBuckets';
import { LIQUID_BUCKETS } from '../domain/liquidBuckets';
import { formatCurrency } from '../lib/formatCurrency';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { usePortfolio } from '../state/usePortfolio';
import type { AssetView } from '../domain/portfolio';

type SortMode = 'value_desc' | 'name_asc';
type UsBrokerFilter = 'all' | 'sub_broker' | 'overseas';

const liquidMeta = CATEGORY_BY_KEY.liquid;
const investmentMeta = CATEGORY_BY_KEY.investment;
const fixedMeta = CATEGORY_BY_KEY.fixed;

const BUCKET_BY_KEY = Object.fromEntries(
  INVESTMENT_BUCKETS.map((b) => [b.key, b]),
);
const LIQUID_BUCKET_BY_KEY = Object.fromEntries(
  LIQUID_BUCKETS.map((b) => [b.key, b]),
);

const isUsStock = (v: AssetView) =>
  v.asset.type === 'stock' && v.asset.broker !== 'tw_broker';
const isTwStock = (v: AssetView) =>
  v.asset.type === 'stock' && v.asset.broker === 'tw_broker';
const isCrypto = (v: AssetView) => v.asset.type === 'crypto';
const isOtherInvestment = (v: AssetView) =>
  v.asset.category === 'investment' && v.asset.type === 'custom';

function totalOf(items: AssetView[]): number {
  return items.reduce((s, v) => s + (v.valueInBase ?? 0), 0);
}

export default function AssetsList() {
  const portfolio = usePortfolio();
  const [sort, setSort] = useState<SortMode>('value_desc');
  const [usBrokerFilter, setUsBrokerFilter] = useState<UsBrokerFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  const isCollapsed = (id: string) => collapsed.has(id);
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
  const liquidUsd = liquidItems.filter((v) => v.asset.currency === 'USD');
  const liquidTwd = liquidItems.filter((v) => v.asset.currency === 'TWD');
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
        <section>
          <TopLevelHeader
            color={liquidMeta.hex}
            label={liquidMeta.label}
            count={liquidItems.length}
            total={totalOf(liquidItems)}
            base={portfolio.base}
            totalAssets={portfolio.totalAssets}
          />
          <div className="mt-2 space-y-3">
            {liquidUsd.length > 0 && (
              <Block
                color={LIQUID_BUCKET_BY_KEY.usd_cash!.color}
                label={LIQUID_BUCKET_BY_KEY.usd_cash!.label}
                count={liquidUsd.length}
                total={totalOf(liquidUsd)}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('liquid_usd')}
                onToggle={() => toggle('liquid_usd')}
                indent
              >
                <AssetTable
                  items={liquidUsd}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </Block>
            )}
            {liquidTwd.length > 0 && (
              <Block
                color={LIQUID_BUCKET_BY_KEY.twd_cash!.color}
                label={LIQUID_BUCKET_BY_KEY.twd_cash!.label}
                count={liquidTwd.length}
                total={totalOf(liquidTwd)}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('liquid_twd')}
                onToggle={() => toggle('liquid_twd')}
                indent
              >
                <AssetTable
                  items={liquidTwd}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </Block>
            )}
          </div>
        </section>
      )}

      {investmentItems.length > 0 && (
        <section>
          <TopLevelHeader
            color={investmentMeta.hex}
            label={investmentMeta.label}
            count={investmentItems.length}
            total={totalOf(investmentItems)}
            base={portfolio.base}
            totalAssets={portfolio.totalAssets}
          />
          <div className="mt-2 space-y-3">
            {allUsStocks.length > 0 && (
              <Block
                color={BUCKET_BY_KEY.us_stock!.color}
                label="美元股票"
                count={allUsStocks.length}
                total={totalOf(allUsStocks)}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('us_stock')}
                onToggle={() => toggle('us_stock')}
                trailing={
                  <UsBrokerChips
                    value={usBrokerFilter}
                    onChange={setUsBrokerFilter}
                  />
                }
                indent
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
              </Block>
            )}
            {twStocks.length > 0 && (
              <Block
                color={BUCKET_BY_KEY.tw_stock!.color}
                label="台灣股票"
                count={twStocks.length}
                total={totalOf(twStocks)}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('tw_stock')}
                onToggle={() => toggle('tw_stock')}
                indent
              >
                <AssetTable
                  items={twStocks}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </Block>
            )}
            {cryptos.length > 0 && (
              <Block
                color={BUCKET_BY_KEY.crypto!.color}
                label="加密貨幣"
                count={cryptos.length}
                total={totalOf(cryptos)}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('crypto')}
                onToggle={() => toggle('crypto')}
                indent
              >
                <AssetTable
                  items={cryptos}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </Block>
            )}
            {others.length > 0 && (
              <Block
                color={BUCKET_BY_KEY.other!.color}
                label="其他"
                count={others.length}
                total={totalOf(others)}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('other')}
                onToggle={() => toggle('other')}
                indent
              >
                <AssetTable
                  items={others}
                  base={portfolio.base}
                  totalAssets={portfolio.totalAssets}
                />
              </Block>
            )}
          </div>
        </section>
      )}

      {fixedItems.length > 0 && (
        <section>
          <TopLevelHeader
            color={fixedMeta.hex}
            label={fixedMeta.label}
            count={fixedItems.length}
            total={totalOf(fixedItems)}
            base={portfolio.base}
            totalAssets={portfolio.totalAssets}
          />
          <div className="mt-2">
            <AssetTable
              items={fixedItems}
              base={portfolio.base}
              totalAssets={portfolio.totalAssets}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function TopLevelHeader({
  color,
  label,
  count,
  total,
  base,
  totalAssets,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
  base: string;
  totalAssets: number;
}) {
  const pct = totalAssets > 0 ? (total / totalAssets) * 100 : null;
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-2">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
      <span className="text-sm text-gray-400">{count} 筆</span>
      <span className="ml-auto flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums text-gray-900">
          {formatCurrency(total, base)}
        </span>
        {pct !== null && (
          <span className="text-base tabular-nums text-gray-500">
            {pct.toFixed(1)}%
          </span>
        )}
      </span>
    </header>
  );
}

function Block({
  color,
  label,
  count,
  total,
  base,
  totalAssets,
  collapsed,
  onToggle,
  trailing,
  indent,
  children,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
  base: string;
  totalAssets: number;
  collapsed: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
  indent?: boolean;
  children: React.ReactNode;
}) {
  const pct = totalAssets > 0 ? (total / totalAssets) * 100 : null;
  return (
    <section className={clsx(indent && 'pl-3')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-2 rounded-md py-1 text-left hover:bg-gray-100/50"
        aria-expanded={!collapsed}
      >
        <Chevron open={!collapsed} />
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <h3
          className={clsx(
            indent
              ? 'text-xs font-semibold uppercase tracking-wider text-gray-600'
              : 'text-sm font-semibold text-gray-700',
          )}
        >
          {label}
        </h3>
        <span className="text-xs text-gray-400">{count} 筆</span>
        {trailing && (
          <span
            className="ml-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {trailing}
          </span>
        )}
        <span className="ml-auto flex items-baseline gap-2 pr-1">
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {formatCurrency(total, base)}
          </span>
          {pct !== null && (
            <span className="text-xs tabular-nums text-gray-500">
              {pct.toFixed(1)}%
            </span>
          )}
        </span>
      </button>
      {!collapsed && <div className="mt-1.5">{children}</div>}
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={clsx(
        'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform',
        open && 'rotate-90',
      )}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4V4z" />
    </svg>
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
          onClick={(e) => {
            e.stopPropagation();
            onChange(key);
          }}
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
  const { asset, valueInAssetCurrency, valueInBase, pricedAt, stale, source } = view;
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
        {source === 'cache' && pricedAt && (
          <div className="text-gray-400">
            報價：{new Date(pricedAt).toLocaleString('zh-TW')}
          </div>
        )}
        {source === 'manual' && <div className="text-gray-500">手動價</div>}
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
