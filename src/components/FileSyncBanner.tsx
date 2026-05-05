import { useFileSync } from '../state/useFileSync';

export default function FileSyncBanner() {
  const { status, grantPermission, loadFromFile, dismissReconciliation, clearError } =
    useFileSync();

  if (status.kind === 'needs_permission') {
    return (
      <Banner tone="amber">
        <span>
          已連結備份檔 <code className="font-mono">{status.meta.name}</code>
          ，但需要重新授權才能讀寫。
        </span>
        <button
          type="button"
          onClick={() => void grantPermission()}
          className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
        >
          授權
        </button>
      </Banner>
    );
  }

  if (status.kind === 'reconcile') {
    const remoteAt = new Date(status.remote.exportedAt).toLocaleString('zh-TW');
    return (
      <Banner tone="amber">
        <span>
          備份檔有較新版本（{remoteAt}）。要從檔案載入並覆蓋目前資料嗎？
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadFromFile()}
            className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            載入檔案
          </button>
          <button
            type="button"
            onClick={() => void dismissReconciliation()}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            保留本機（覆寫檔案）
          </button>
        </div>
      </Banner>
    );
  }

  if (status.kind === 'error') {
    return (
      <Banner tone="red">
        <span>{status.message}</span>
        <button
          type="button"
          onClick={clearError}
          className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          關閉
        </button>
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  children,
}: {
  tone: 'amber' | 'red';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-red-300 bg-red-50 text-red-900';
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm ${cls}`}
    >
      {children}
    </div>
  );
}
