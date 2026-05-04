import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Asset, AssetType, Broker, Category } from '../db/types';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { ASSET_TYPE_LABELS, CATEGORIES } from '../domain/categories';
import { BROKERS, BROKER_BY_CODE } from '../domain/brokers';
import { CRYPTOS, CRYPTO_BY_ID } from '../domain/cryptos';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
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
  cryptoId: string;
  notes: string;
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
  cryptoId: CRYPTOS[0].id,
  notes: '',
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
        cryptoId,
        notes: existing.notes ?? '',
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
        const qty = Number(form.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
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
        if (!brokerMeta.pricingNotYetSupported) stockSymbolToFetch = normalized;
      } else if (form.type === 'crypto') {
        const cryptoMeta = CRYPTO_BY_ID[form.cryptoId];
        if (!cryptoMeta) {
          alert('請選擇幣種');
          return;
        }
        const qty = Number(form.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
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
        const value = Number(form.manualValue);
        if (!Number.isFinite(value)) {
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
        await assetsRepo.create(payload);
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
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                placeholder="0"
                className="input text-right tabular-nums"
                required
              />
            </Field>
            <p className="text-xs text-gray-500">
              幣別 {brokerMeta.currency}（依券商類別自動決定）。
              {brokerMeta.pricingNotYetSupported
                ? '台股報價尚未支援，市值會暫顯示為 0，等價格抓取功能完成後會自動補上。'
                : '儲存時自動抓當日收盤計算市值。'}
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
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                placeholder="例如：0.05"
                className="input text-right tabular-nums"
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
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={form.manualValue}
                onChange={(e) => update('manualValue', e.target.value)}
                placeholder="0"
                className="input text-right tabular-nums"
                required
              />
            </Field>
          </div>
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
