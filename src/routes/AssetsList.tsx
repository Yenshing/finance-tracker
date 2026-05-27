import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CATEGORY_BY_KEY, ASSET_TYPE_LABELS } from '../domain/categories';
import { BROKER_BY_CODE } from '../domain/brokers';
import { CRYPTO_BY_ID } from '../domain/cryptos';
import {
  INVESTMENT_BUCKET_BY_KEY,
  US_STOCK_PARENT,
} from '../domain/investmentBuckets';
import { LIQUID_BUCKETS } from '../domain/liquidBuckets';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { db } from '../db/database';
import { deleteInvestmentWithCredit } from '../domain/cashAdjustment';
import AmountInput from '../components/AmountInput';
import { formatCurrency } from '../lib/formatCurrency';
import { parseAmount } from '../lib/parseAmount';
import { usePortfolio } from '../state/usePortfolio';
import {
  HIDDEN,
  useAmountsHidden,
  useFormatMoney,
} from '../state/useAmountFormat';
import type { AssetView } from '../domain/portfolio';
import type { Asset } from '../db/types';

type SortMode = 'value_desc' | 'name_asc';

const COLLAPSE_STORAGE_KEY = 'finance-tracker:assets-collapsed';

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((s): s is string => typeof s === 'string'));
  } catch {
    return new Set();
  }
}

const liquidMeta = CATEGORY_BY_KEY.liquid;
const investmentMeta = CATEGORY_BY_KEY.investment;
const fixedMeta = CATEGORY_BY_KEY.fixed;

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
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const liquidAccounts = useLiveQuery(async () => {
    const all = await db.assets.toArray();
    return all.filter((a) => !a.archivedAt && a.category === 'liquid');
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        COLLAPSE_STORAGE_KEY,
        JSON.stringify([...collapsed]),
      );
    } catch {
      /* quota or storage disabled — silently ignore */
    }
  }, [collapsed]);

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  async function requestDelete(asset: Asset) {
    if (!asset.id) return;
    if (asset.category === 'investment') {
      setDeleteTarget(asset);
      return;
    }
    const cat = CATEGORY_BY_KEY[asset.category].label;
    if (!confirm(`確定要刪除「${asset.name}」(${cat}) 嗎？`)) return;
    await assetsRepo.remove(asset.id);
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
  const usSubBroker = allUsStocks.filter((v) => v.asset.broker === 'sub_broker');
  const usOverseas = allUsStocks.filter((v) => v.asset.broker === 'overseas');
  const twStocks = sortItems(investmentItems.filter(isTwStock));
  const cryptos = sortItems(investmentItems.filter(isCrypto));
  const others = sortItems(investmentItems.filter(isOtherInvestment));

  // Pre-compute totals per block so within-block percentages don't shift
  // when a chip filter hides rows.
  const liquidUsdTotal = totalOf(liquidUsd);
  const liquidTwdTotal = totalOf(liquidTwd);
  const usStocksTotal = totalOf(allUsStocks);
  const usSubBrokerTotal = totalOf(usSubBroker);
  const usOverseasTotal = totalOf(usOverseas);
  const twStocksTotal = totalOf(twStocks);
  const cryptosTotal = totalOf(cryptos);
  const othersTotal = totalOf(others);
  const fixedTotal = totalOf(fixedItems);

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
                total={liquidUsdTotal}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('liquid_usd')}
                onToggle={() => toggle('liquid_usd')}
                indent
              >
                <AssetTable
                  items={liquidUsd}
                  base={portfolio.base}
                  blockTotal={liquidUsdTotal}
                  onDelete={requestDelete}
                />
              </Block>
            )}
            {liquidTwd.length > 0 && (
              <Block
                color={LIQUID_BUCKET_BY_KEY.twd_cash!.color}
                label={LIQUID_BUCKET_BY_KEY.twd_cash!.label}
                count={liquidTwd.length}
                total={liquidTwdTotal}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('liquid_twd')}
                onToggle={() => toggle('liquid_twd')}
                indent
              >
                <AssetTable
                  items={liquidTwd}
                  base={portfolio.base}
                  blockTotal={liquidTwdTotal}
                  onDelete={requestDelete}
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
                color={US_STOCK_PARENT.color}
                label={US_STOCK_PARENT.label}
                count={allUsStocks.length}
                total={usStocksTotal}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('us_stock')}
                onToggle={() => toggle('us_stock')}
                indent
              >
                <div className="space-y-2">
                  {usSubBroker.length > 0 && (
                    <Block
                      color={INVESTMENT_BUCKET_BY_KEY.us_sub_broker.color}
                      label={INVESTMENT_BUCKET_BY_KEY.us_sub_broker.label}
                      count={usSubBroker.length}
                      total={usSubBrokerTotal}
                      base={portfolio.base}
                      totalAssets={portfolio.totalAssets}
                      collapsed={isCollapsed('us_stock_sub_broker')}
                      onToggle={() => toggle('us_stock_sub_broker')}
                      indent
                    >
                      <AssetTable
                        items={usSubBroker}
                        base={portfolio.base}
                        blockTotal={usSubBrokerTotal}
                        onDelete={requestDelete}
                      />
                    </Block>
                  )}
                  {usOverseas.length > 0 && (
                    <Block
                      color={INVESTMENT_BUCKET_BY_KEY.us_overseas.color}
                      label={INVESTMENT_BUCKET_BY_KEY.us_overseas.label}
                      count={usOverseas.length}
                      total={usOverseasTotal}
                      base={portfolio.base}
                      totalAssets={portfolio.totalAssets}
                      collapsed={isCollapsed('us_stock_overseas')}
                      onToggle={() => toggle('us_stock_overseas')}
                      indent
                    >
                      <AssetTable
                        items={usOverseas}
                        base={portfolio.base}
                        blockTotal={usOverseasTotal}
                        onDelete={requestDelete}
                      />
                    </Block>
                  )}
                </div>
              </Block>
            )}
            {twStocks.length > 0 && (
              <Block
                color={INVESTMENT_BUCKET_BY_KEY.tw_stock.color}
                label="台灣股票"
                count={twStocks.length}
                total={twStocksTotal}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('tw_stock')}
                onToggle={() => toggle('tw_stock')}
                indent
              >
                <AssetTable
                  items={twStocks}
                  base={portfolio.base}
                  blockTotal={twStocksTotal}
                  onDelete={requestDelete}
                />
              </Block>
            )}
            {cryptos.length > 0 && (
              <Block
                color={INVESTMENT_BUCKET_BY_KEY.crypto.color}
                label="加密貨幣"
                count={cryptos.length}
                total={cryptosTotal}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('crypto')}
                onToggle={() => toggle('crypto')}
                indent
              >
                <AssetTable
                  items={cryptos}
                  base={portfolio.base}
                  blockTotal={cryptosTotal}
                  onDelete={requestDelete}
                />
              </Block>
            )}
            {others.length > 0 && (
              <Block
                color={INVESTMENT_BUCKET_BY_KEY.other.color}
                label="其他"
                count={others.length}
                total={othersTotal}
                base={portfolio.base}
                totalAssets={portfolio.totalAssets}
                collapsed={isCollapsed('other')}
                onToggle={() => toggle('other')}
                indent
              >
                <AssetTable
                  items={others}
                  base={portfolio.base}
                  blockTotal={othersTotal}
                  onDelete={requestDelete}
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
            total={fixedTotal}
            base={portfolio.base}
            totalAssets={portfolio.totalAssets}
          />
          <div className="mt-2">
            <AssetTable
              items={fixedItems}
              base={portfolio.base}
              blockTotal={fixedTotal}
              onDelete={requestDelete}
            />
          </div>
        </section>
      )}

      {deleteTarget && (
        <DeleteInvestmentModal
          asset={deleteTarget}
          liquidAccounts={liquidAccounts ?? []}
          onClose={() => setDeleteTarget(null)}
        />
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
  const fmt = useFormatMoney();
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
          {fmt(total, base)}
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
  indent?: boolean;
  children: React.ReactNode;
}) {
  const fmt = useFormatMoney();
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
        <span className="ml-auto flex items-baseline gap-2 pr-1">
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {fmt(total, base)}
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

function AssetTable({
  items,
  base,
  blockTotal,
  onDelete,
}: {
  items: AssetView[];
  base: string;
  blockTotal: number;
  onDelete: (asset: Asset) => void;
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
            <th className="px-4 py-2 text-right">區內佔比</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((view) => (
            <AssetRow
              key={view.asset.id}
              view={view}
              base={base}
              blockTotal={blockTotal}
              onDelete={onDelete}
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
  blockTotal,
  onDelete,
}: {
  view: AssetView;
  base: string;
  blockTotal: number;
  onDelete: (asset: Asset) => void;
}) {
  const fmt = useFormatMoney();
  const hidden = useAmountsHidden();
  const { asset, valueInAssetCurrency, valueInBase, pricedAt, stale, source } = view;
  const isStock = asset.type === 'stock' && asset.symbol;
  const isCryptoRow = asset.type === 'crypto' && asset.symbol;
  const broker = asset.broker ? BROKER_BY_CODE[asset.broker] : null;
  const crypto = isCryptoRow ? CRYPTO_BY_ID[asset.symbol!] : null;
  const pct =
    valueInBase !== null && blockTotal > 0
      ? (valueInBase / blockTotal) * 100
      : null;

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
          {hidden ? HIDDEN : asset.quantity} 股
          {!hidden && valueInAssetCurrency > 0 && asset.quantity ? (
            <>
              {' × '}
              {fmt(valueInAssetCurrency / asset.quantity, asset.currency)}
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
          {hidden ? HIDDEN : asset.quantity}
          {!hidden && valueInAssetCurrency > 0 && asset.quantity ? (
            <>
              {' × '}
              {fmt(valueInAssetCurrency / asset.quantity, 'USD')}
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
        {fmt(valueInAssetCurrency, asset.currency)}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums text-gray-600">
        {valueInBase === null ? (
          <span className="text-amber-600">無匯率</span>
        ) : asset.currency === base ? (
          <span className="text-gray-300">—</span>
        ) : (
          fmt(valueInBase, base)
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
          onClick={() => onDelete(asset)}
          className="text-sm text-red-600 hover:text-red-700"
        >
          刪除
        </button>
      </td>
    </tr>
  );
}


interface DeleteModalProps {
  asset: Asset;
  liquidAccounts: Asset[];
  onClose: () => void;
}

function DeleteInvestmentModal({
  asset,
  liquidAccounts,
  onClose,
}: DeleteModalProps) {
  const [enableCredit, setEnableCredit] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const matching = useMemo(
    () => liquidAccounts.filter((a) => a.currency === asset.currency),
    [liquidAccounts, asset.currency],
  );

  const numericAmount = parseAmount(amount);
  const selected =
    accountId && matching.find((a) => String(a.id) === accountId);
  const balanceAfter =
    selected && numericAmount !== null
      ? (selected.manualValue ?? 0) + numericAmount
      : null;

  async function handleConfirm() {
    if (!asset.id) return;
    setBusy(true);
    try {
      let cashAdjustment;
      if (enableCredit) {
        const accId = Number(accountId);
        if (!Number.isInteger(accId) || accId <= 0) {
          alert("請選擇入帳帳戶");
          setBusy(false);
          return;
        }
        if (numericAmount === null || numericAmount <= 0) {
          alert("請輸入有效的入帳金額");
          setBusy(false);
          return;
        }
        cashAdjustment = { accountId: accId, amount: numericAmount };
      }
      await deleteInvestmentWithCredit({
        assetIdToDelete: asset.id,
        cashAdjustment,
      });
      onClose();
    } catch (e) {
      alert(`刪除失敗：${(e as Error).message}`);
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            刪除「{asset.name}」？
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            這個動作通常代表你已賣出或結清部位。可選擇把賣出所得加回流動資金。
          </p>
        </header>

        {matching.length > 0 ? (
          <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={enableCredit}
                onChange={(e) => setEnableCredit(e.target.checked)}
              />
              <span>同時將賣出所得加回流動資金</span>
            </label>
            {enableCredit && (
              <>
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-gray-700">
                    入帳帳戶
                  </div>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="select"
                  >
                    <option value="">— 請選擇 —</option>
                    {matching.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.name}（餘額{" "}
                        {formatCurrency(a.manualValue ?? 0, a.currency)}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-gray-700">
                    入帳金額（{asset.currency}）
                  </div>
                  <AmountInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="從交割單抄入，已扣手續費後的實收"
                    unit={asset.currency}
                  />
                </label>
                {balanceAfter !== null && (
                  <div className="text-xs text-gray-500">
                    入帳後餘額：{formatCurrency(balanceAfter, asset.currency)}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            尚無 {asset.currency} 流動資金帳戶可供入帳；可直接刪除。
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "處理中…" : "刪除"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
