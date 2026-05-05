import { useRef, useState } from 'react';
import { settingsRepo } from '../db/repositories/settingsRepo';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
import { useSettings } from '../state/usePortfolio';
import { useFileSync } from '../state/useFileSync';
import {
  exportAll,
  parseImportFile,
  replaceAll,
  suggestedFileName,
} from '../services/io/exportImport';

export default function Settings() {
  const settings = useSettings();
  const fileSync = useFileSync();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'idle' | 'exporting' | 'importing'>('idle');
  const [message, setMessage] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null);

  if (!settings) return <div className="text-sm text-gray-500">載入中…</div>;

  async function onCurrencyChange(value: string) {
    await settingsRepo.update({ baseCurrency: value });
  }

  async function handleExport() {
    setBusy('exporting');
    setMessage(null);
    try {
      const data = await exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({
        kind: 'ok',
        text: `已匯出 ${data.assets.length} 筆資產 + ${data.snapshots.length} 筆快照`,
      });
    } catch (e) {
      setMessage({ kind: 'err', text: `匯出失敗：${(e as Error).message}` });
    } finally {
      setBusy('idle');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy('importing');
    setMessage(null);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = parseImportFile(JSON.parse(text));
      } catch {
        throw new Error('檔案格式不正確或不是本工具匯出的 JSON');
      }
      const ok = window.confirm(
        `將匯入 ${parsed.assets.length} 筆資產、${parsed.snapshots.length} 筆快照` +
          `${parsed.settings ? '、設定' : ''}。\n\n` +
          `這會覆蓋目前所有資料（包含快取）。確定要繼續嗎？`,
      );
      if (!ok) {
        setBusy('idle');
        return;
      }
      const summary = await replaceAll(parsed);
      setMessage({
        kind: 'ok',
        text: `已匯入 ${summary.assets} 筆資產、${summary.snapshots} 筆快照${
          summary.hasSettings ? '、設定' : ''
        }`,
      });
    } catch (e) {
      setMessage({ kind: 'err', text: `匯入失敗：${(e as Error).message}` });
    } finally {
      setBusy('idle');
    }
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
            所有資產與淨資產數字會換算為此幣別顯示。
          </p>
        </label>
      </section>

      {fileSync.status.kind === 'disabled' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-2 font-semibold text-gray-800">資料備份</h2>
          <p className="mb-3 text-xs text-gray-500">
            此瀏覽器不支援 File System Access API（Safari / Firefox），
            無法使用「連結備份檔」自動同步功能。請定期手動匯出 JSON
            備份；換機器時用「匯入」還原。匯入會覆蓋目前所有資料。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={busy !== 'idle'}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === 'exporting' ? '匯出中…' : '匯出 .json'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== 'idle'}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'importing' ? '匯入中…' : '匯入 .json'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          {message && (
            <div
              className={
                message.kind === 'ok'
                  ? 'mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                  : 'mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800'
              }
            >
              {message.text}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 font-semibold text-gray-800">連結備份檔（自動同步）</h2>
          <p className="mb-3 text-xs text-gray-500">
            類似 Obsidian 的「資料就是檔案」模式：選一個 .json
            檔（建議放在 iCloud / Dropbox / Google Drive
            同步資料夾），之後 App
            每次變動會自動寫回該檔；換機器只要連結同一個檔即可還原。
          </p>
          <FileSyncPanel
            status={fileSync.status}
            onLink={fileSync.link}
            onUnlink={fileSync.unlink}
          />
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        <h2 className="mb-2 font-semibold text-gray-800">關於</h2>
        <p>
          所有資料儲存在你瀏覽器本地的 IndexedDB，沒有後端伺服器。清除瀏覽器資料會一併清除這個
          App 的內容；連結備份檔或定期匯出 JSON 可以避免遺失。
        </p>
      </section>
    </div>
  );
}

function FileSyncPanel({
  status,
  onLink,
  onUnlink,
}: {
  status: ReturnType<typeof useFileSync>['status'];
  onLink: (mode: 'open' | 'save') => Promise<void>;
  onUnlink: () => Promise<void>;
}) {
  if (status.kind === 'disabled') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        此瀏覽器不支援 File System Access API；請改用 Chrome / Edge / Brave，
        或繼續使用上方的「匯出 / 匯入 .json」手動備份。
      </div>
    );
  }
  if (status.kind === 'loading') {
    return <div className="text-xs text-gray-500">檢查連結狀態…</div>;
  }
  if (
    status.kind === 'unlinked' ||
    status.kind === 'error' ||
    status.kind === 'needs_permission' ||
    status.kind === 'reconcile'
  ) {
    return (
      <div className="space-y-2">
        {status.kind === 'needs_permission' && (
          <div className="text-xs text-amber-700">
            目前已連結 <code className="font-mono">{status.meta.name}</code>
            ，但需要重新授權（瀏覽器最上方有黃條提示）。
          </div>
        )}
        {status.kind === 'reconcile' && (
          <div className="text-xs text-amber-700">
            檔案有比較新的版本，請看頁面最上方的黃條決定是否載入。
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onLink('save')}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            建立新備份檔
          </button>
          <button
            type="button"
            onClick={() => void onLink('open')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            連結既有備份檔
          </button>
        </div>
      </div>
    );
  }
  // status.kind === 'linked'
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <div className="font-semibold">
          已連結：<code className="font-mono">{status.meta.name}</code>
        </div>
        <div className="mt-1 text-xs">
          {status.syncing
            ? '寫入中…'
            : status.lastWriteAt
              ? `上次寫入：${new Date(status.lastWriteAt).toLocaleString('zh-TW')}`
              : '尚未寫入'}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onUnlink()}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        解除連結
      </button>
    </div>
  );
}
