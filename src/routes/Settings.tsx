import { settingsRepo } from '../db/repositories/settingsRepo';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
import { useSettings } from '../state/usePortfolio';

export default function Settings() {
  const settings = useSettings();
  if (!settings) return <div className="text-sm text-gray-500">載入中…</div>;

  async function onCurrencyChange(value: string) {
    await settingsRepo.update({ baseCurrency: value });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">設定</h1>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
        <label className="block">
          <div className="mb-1 text-xs font-medium text-gray-700">基準幣別</div>
          <select
            value={settings.baseCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="select"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            所有資產與淨資產數字會換算為此幣別顯示。換算需要匯率資料（將於下一階段加入）。
          </p>
        </label>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        <h2 className="mb-2 font-semibold text-gray-800">關於</h2>
        <p>
          所有資料儲存在你瀏覽器本地的 IndexedDB。清除瀏覽器資料會一併清除這個 App
          的內容。日後將提供匯出 / 匯入 JSON 備份。
        </p>
      </section>
    </div>
  );
}
