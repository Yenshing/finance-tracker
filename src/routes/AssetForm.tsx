import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Asset, AssetType, Category } from '../db/types';
import { assetsRepo } from '../db/repositories/assetsRepo';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { ASSET_TYPE_LABELS, CATEGORIES } from '../domain/categories';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';

const TYPES_BY_CATEGORY: Record<Category, AssetType[]> = {
  liquid: ['cash', 'custom'],
  investment: ['stock', 'crypto', 'custom'],
  fixed: ['real_estate', 'vehicle', 'custom'],
  receivable: ['receivable'],
  liability: ['liability'],
};

interface FormState {
  category: Category;
  type: AssetType;
  name: string;
  currency: string;
  manualValue: string;
  notes: string;
}

const blank = (currency: string): FormState => ({
  category: 'liquid',
  type: 'cash',
  name: '',
  currency,
  manualValue: '',
  notes: '',
});

export default function AssetForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const editingId = id ? Number(id) : undefined;
  const isEdit = editingId !== undefined && !Number.isNaN(editingId);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

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
      setForm({
        category: existing.category,
        type: existing.type,
        name: existing.name,
        currency: existing.currency,
        manualValue:
          existing.manualValue !== undefined ? String(existing.manualValue) : '',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      alert('請輸入名稱');
      return;
    }
    const value = Number(form.manualValue);
    if (!Number.isFinite(value)) {
      alert('請輸入有效的金額');
      return;
    }

    setSaving(true);
    const payload: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
      category: form.category,
      type: form.type,
      name: trimmedName,
      currency: form.currency,
      manualValue: value,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (isEdit) {
        await assetsRepo.update(editingId!, payload);
      } else {
        await assetsRepo.create(payload);
      }
      navigate('/assets');
    } finally {
      setSaving(false);
    }
  }

  const allowedTypes = TYPES_BY_CATEGORY[form.category];

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
            onChange={(e) => update('type', e.target.value as AssetType)}
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
            placeholder="例如：玉山活存、台積電 (2330)、自住房…"
            className="input"
            required
          />
        </Field>

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

        <Field label="備註（可選）">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
            className="input"
          />
        </Field>

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
