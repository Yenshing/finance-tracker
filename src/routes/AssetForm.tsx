import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Asset, AssetType, Broker, Category } from '../db/types';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { db } from '../db/database';
import { ASSET_TYPE_LABELS, CATEGORIES } from '../domain/categories';
import { BROKERS, BROKER_BY_CODE } from '../domain/brokers';
import { CRYPTOS, CRYPTO_BY_ID } from '../domain/cryptos';
import { createInvestmentWithDeduction } from '../domain/cashAdjustment';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
import { formatCurrency } from '../lib/formatCurrency';
import { parseAmount } from '../lib/parseAmount';
import AmountInput from '../components/AmountInput';
import { normalizeSymbol, parseSymbol } from '../services/prices/symbolNormalize';
import { fetchAndCacheQuote } from '../services/prices/proxyClient';
import { fetchAndCacheCryptos } from '../services/prices/coingeckoClient';

const TYPES_BY_CATEGORY: Record<Category, AssetType[]> = {
  liquid: ['cash', 'custom'],
  investment: ['stock', 'crypto', 'custom'],
  fixed: ['real_estate', 'vehicle', 'custom'],
};

interface FormState {
  category: Category;
  type: AssetType;
  name: string;
  currency: string;
  manualValue: string;
  broker: Broker;
  symbolInput: string;
  quantity: string;
  manualUnitPrice: string;
  cryptoId: string;
  notes: string;
  deductEnabled: boolean;
  deductAccountId: string; // string for select value; '' = unselected
  deductAmount: string;
}

const blank = (currency: string): FormState => ({
  category: 'liquid',
  type: 'cash',
  name: '',
  currency,
  manualValue: '',
  broker: 'sub_broker',
  symbolInput: '',
  quantity: '',
  manualUnitPrice: '',
  cryptoId: CRYPTOS[0].id,
  notes: '',
  deductEnabled: false,
  deductAccountId: '',
  deductAmount: '',
});

function inferBroker(asset: Asset): Broker {
  if (asset.broker) return asset.broker;
  if (asset.symbol) {
    const { market } = parseSymbol(asset.symbol);
    return market === 'TW' ? 'tw_broker' : 'sub_broker';
  }
  return 'sub_broker';
}

function defaultCryptoNameFor(id: string): string {
  const meta = CRYPTO_BY_ID[id];
  return meta ? `${meta.symbol} ${meta.name}` : '';
}

export default function AssetForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const editingId = id ? Number(id) : undefined;
  const isEdit = editingId !== undefined && !Number.isNaN(editingId);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  // For the optional "deduct from liquid account" feature on new investments.
  const liquidAccounts = useLiveQuery(async () => {
    const all = await db.assets.toArray();
    return all.filter((a) => !a.archivedAt && a.category === 'liquid');
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await settingsRepo.get();
      if (!isEdit) {
        if (!cancelled) setForm(blank(settings.baseCurrency));
        return;
      }
      const existing = await assetsRepo.getById(editingId!);
      if (cancelled) return;
      if (!existing) {
        navigate('/assets', { replace: true });
        return;
      }
      const broker = inferBroker(existing);
      const stockParsed =
        existing.type === 'stock' && existing.symbol
          ? parseSymbol(existing.symbol)
          : null;
      const cryptoId =
        existing.type === 'crypto' && existing.symbol && CRYPTO_BY_ID[existing.symbol]
          ? existing.symbol
          : CRYPTOS[0].id;
      setForm({
        category: existing.category,
        type: existing.type,
        name: existing.name,
        currency: existing.currency,
        manualValue:
          existing.manualValue !== undefined ? String(existing.manualValue) : '',
        broker,
        symbolInput: stockParsed?.raw ?? '',
        quantity: existing.quantity !== undefined ? String(existing.quantity) : '',
        manualUnitPrice:
          existing.manualUnitPrice !== undefined
            ? String(existing.manualUnitPrice)
            : '',
        cryptoId,
        notes: existing.notes ?? '',
        deductEnabled: false,
        deductAccountId: '',
        deductAmount: '',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, isEdit, navigate]);

  if (!form) return <div className="text-sm text-gray-500">載入中…</div>;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function onCategoryChange(next: Category) {
    setForm((prev) => {
      if (!prev) return prev;
      const allowed = TYPES_BY_CATEGORY[next];
      const type = allowed.includes(prev.type) ? prev.type : allowed[0];
      return { ...prev, category: next, type };
    });
  }

  function onTypeChange(next: AssetType) {
    setForm((prev) => {
      if (!prev) return prev;
      const patch: Partial<FormState> = { type: next };
      if (next === 'crypto' && !prev.name.trim()) {
        patch.name = defaultCryptoNameFor(prev.cryptoId);
      }
      return { ...prev, ...patch };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      alert('請輸入名稱');
      return;
    }

    setSaving(true);
    setPriceError(null);
    try {
      let payload: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>;
      let stockSymbolToFetch: string | null = null;
      let cryptoIdToFetch: string | null = null;

      if (form.type === 'stock') {
        const brokerMeta = BROKER_BY_CODE[form.broker];
        const normalized = normalizeSymbol(form.symbolInput, brokerMeta.market);
        if (!normalized) {
          alert('請輸入股票代號');
          return;
        }
        const qty = parseAmount(form.quantity);
        if (qty === null || qty <= 0) {
          alert('請輸入有效的股數');
          return;
        }
        payload = {
          category: form.category,
          type: form.type,
          name: trimmedName,
          currency: brokerMeta.currency,
          symbol: normalized,
          quantity: qty,
          broker: form.broker,
          notes: form.notes.trim() || undefined,
        };
        stockSymbolToFetch = normalized;
      } else if (form.type === 'crypto') {
        const cryptoMeta = CRYPTO_BY_ID[form.cryptoId];
        if (!cryptoMeta) {
          alert('請選擇幣種');
          return;
        }
        const qty = parseAmount(form.quantity);
        if (qty === null || qty <= 0) {
          alert('請輸入有效的數量');
          return;
        }
        payload = {
          category: form.category,
          type: 'crypto',
          name: trimmedName,
          currency: 'USD',
          symbol: cryptoMeta.id,
          quantity: qty,
          notes: form.notes.trim() || undefined,
        };
        cryptoIdToFetch = cryptoMeta.id;
      } else {
        const value = parseAmount(form.manualValue);
        if (value === null) {
          alert('請輸入有效的金額');
          return;
        }
        payload = {
          category: form.category,
          type: form.type,
          name: trimmedName,
          currency: form.currency,
          manualValue: value,
          notes: form.notes.trim() || undefined,
        };
      }

      if (isEdit) {
        await assetsRepo.update(editingId!, payload);
      } else {
        // Optionally deduct cost from a liquid account in one transaction.
        let cashAdjustment;
        if (
          form.deductEnabled &&
          (form.type === 'stock' || form.type === 'crypto')
        ) {
          const accountId = Number(form.deductAccountId);
          const amount = parseAmount(form.deductAmount);
          if (!Number.isInteger(accountId) || accountId <= 0) {
            alert('請選擇扣款帳戶');
            return;
          }
          if (amount === null || amount <= 0) {
            alert('請輸入有效的扣款金額');
            return;
          }
          cashAdjustment = { accountId, amount };
        }
        try {
          await createInvestmentWithDeduction({
            newAsset: payload,
            cashAdjustment,
          });
        } catch (e) {
          alert(`建立失敗：${(e as Error).message}`);
          return;
        }
      }

      if (stockSymbolToFetch) {
        const result = await fetchAndCacheQuote(stockSymbolToFetch);
        if (!result.ok) {
          setPriceError(`已儲存，但抓取股價失敗：${result.error ?? '未知錯誤'}`);
          setSaving(false);
          return;
        }
      }
      if (cryptoIdToFetch) {
        const results = await fetchAndCacheCryptos([cryptoIdToFetch]);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          setPriceError(`已儲存，但抓取幣價失敗：${failed.error ?? '未知錯誤'}`);
          setSaving(false);
          return;
        }
      }
      navigate('/assets');
    } finally {
      setSaving(false);
    }
  }

  const allowedTypes = TYPES_BY_CATEGORY[form.category];
  const isStock = form.type === 'stock';
  const isCrypto = form.type === 'crypto';
  const brokerMeta = BROKER_BY_CODE[form.broker];

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">
        {isEdit ? '編輯資產' : '新增資產'}
      </h1>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <Field label="分類">
          <select
            value={form.category}
            onChange={(e) => onCategoryChange(e.target.value as Category)}
            className="select"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} — {c.description}
              </option>
            ))}
          </select>
        </Field>

        <Field label="類型">
          <select
            value={form.type}
            onChange={(e) => onTypeChange(e.target.value as AssetType)}
            className="select"
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="名稱">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={
              isStock
                ? '例如：台積電'
                : isCrypto
                  ? '例如：BTC 主錢包'
                  : '例如：玉山活存、自住房…'
            }
            className="input"
            required
          />
        </Field>

        {isStock && (
          <>
            <Field label="券商類別">
              <select
                value={form.broker}
                onChange={(e) => update('broker', e.target.value as Broker)}
                className="select"
              >
                {BROKERS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.label}（{b.market === 'US' ? '美股' : '台股'}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="代號">
              <input
                type="text"
                value={form.symbolInput}
                onChange={(e) => update('symbolInput', e.target.value)}
                placeholder={brokerMeta.hint}
                className="input"
                required
              />
            </Field>
            <Field label="股數">
              <AmountInput
                value={form.quantity}
                onChange={(v) => update('quantity', v)}
                placeholder="0"
                required
              />
            </Field>
            <p className="text-xs text-gray-500">
              幣別 {brokerMeta.currency}（依券商類別自動決定）。儲存時自動抓當日收盤計算市值。
            </p>
          </>
        )}

        {isCrypto && (
          <>
            <Field label="幣種">
              <select
                value={form.cryptoId}
                onChange={(e) => update('cryptoId', e.target.value)}
                className="select"
              >
                {CRYPTOS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="持有數量">
              <AmountInput
                value={form.quantity}
                onChange={(v) => update('quantity', v)}
                placeholder="例如：0.05"
                required
              />
            </Field>
            <p className="text-xs text-gray-500">
              幣別 USD（CoinGecko 報價）。儲存時會自動抓當下幣價計算市值。
            </p>
          </>
        )}

        {!isStock && !isCrypto && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="幣別" className="col-span-1">
              <select
                value={form.currency}
                onChange={(e) => update('currency', e.target.value)}
                className="select"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="金額" className="col-span-2">
              <AmountInput
                value={form.manualValue}
                onChange={(v) => update('manualValue', v)}
                placeholder="0"
                required
              />
            </Field>
          </div>
        )}

        {!isEdit && (isStock || isCrypto) && (
          <DeductionSection
            currency={isStock ? brokerMeta.currency : 'USD'}
            liquidAccounts={liquidAccounts ?? []}
            enabled={form.deductEnabled}
            accountId={form.deductAccountId}
            amount={form.deductAmount}
            onEnabledChange={(v) => update('deductEnabled', v)}
            onAccountChange={(v) => update('deductAccountId', v)}
            onAmountChange={(v) => update('deductAmount', v)}
          />
        )}

        <Field label="備註（可選）">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
            className="input"
          />
        </Field>

        {priceError && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {priceError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            to="/assets"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? '儲存中…' : isEdit ? '更新' : '新增'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <div className="mb-1 text-xs font-medium text-gray-700">{label}</div>
      {children}
    </label>
  );
}

interface DeductionSectionProps {
  currency: string;
  liquidAccounts: Asset[];
  enabled: boolean;
  accountId: string;
  amount: string;
  onEnabledChange: (v: boolean) => void;
  onAccountChange: (v: string) => void;
  onAmountChange: (v: string) => void;
}

function DeductionSection({
  currency,
  liquidAccounts,
  enabled,
  accountId,
  amount,
  onEnabledChange,
  onAccountChange,
  onAmountChange,
}: DeductionSectionProps) {
  const matching = useMemo(
    () => liquidAccounts.filter((a) => a.currency === currency),
    [liquidAccounts, currency],
  );

  if (matching.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        尚無 {currency} 流動資金帳戶可供扣款。先到「資產」頁建立一個{currency}{' '}
        現金 / 銀行帳戶後即可使用。
      </div>
    );
  }

  const numericAmount = parseAmount(amount);
  const selected =
    accountId && matching.find((a) => String(a.id) === accountId);
  const balanceAfter =
    selected && numericAmount !== null
      ? (selected.manualValue ?? 0) - numericAmount
      : null;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span>同時從流動資金扣款</span>
      </label>
      {enabled && (
        <div className="mt-3 space-y-3">
          <Field label="扣款帳戶">
            <select
              value={accountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="select"
              required
            >
              <option value="">— 請選擇 —</option>
              {matching.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}（餘額 {formatCurrency(a.manualValue ?? 0, a.currency)}）
                </option>
              ))}
            </select>
          </Field>
          <Field label={`實付金額（${currency}）`}>
            <AmountInput
              value={amount}
              onChange={onAmountChange}
              placeholder="從券商交割單抄入，含手續費"
              unit={currency}
              required
            />
          </Field>
          {balanceAfter !== null && balanceAfter < 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              扣款後餘額將為 {formatCurrency(balanceAfter, currency)}
              （仍可送出）
            </div>
          )}
        </div>
      )}
    </div>
  );
}
