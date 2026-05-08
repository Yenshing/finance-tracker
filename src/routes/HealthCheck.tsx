import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { usePortfolio } from '../state/usePortfolio';
import {
  buildHealthCheckPrompt,
  type HealthScope,
} from '../domain/healthCheckPrompt';

const SCOPES: { key: HealthScope; label: string }[] = [
  { key: 'all', label: '全部投資' },
  { key: 'us_stock', label: '美元股票' },
  { key: 'tw_stock', label: '台灣股票' },
];

export default function HealthCheck() {
  const portfolio = usePortfolio();
  const [scope, setScope] = useState<HealthScope>('all');
  const [copied, setCopied] = useState(false);

  const investmentItems = useMemo(
    () =>
      portfolio?.assets.filter((v) => v.asset.category === 'investment') ?? [],
    [portfolio],
  );

  const prompt = useMemo(() => {
    if (!portfolio) return '';
    return buildHealthCheckPrompt(investmentItems, scope);
  }, [portfolio, investmentItems, scope]);

  if (!portfolio) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('複製失敗，請手動選取文字複製。');
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">健檢 prompt 產生器</h1>
        <p className="text-sm text-gray-600">
          根據目前投資資產整理一段格式化的 prompt，複製貼到 ChatGPT / Claude /
          Gemini 等 AI 服務，請對方做資產配置健檢。產出內容只包含標的、代號與比例，
          不含金額或股數，避免絕對金額外洩。
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-gray-700">分析範圍</label>
          <div className="flex flex-wrap gap-1">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  scope === s.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">預覽</h2>
          <div className="flex items-center gap-2">
            {copied && (
              <span className="text-xs text-emerald-700">已複製</span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              複製到剪貼簿
            </button>
          </div>
        </div>
        <textarea
          value={prompt}
          readOnly
          rows={20}
          className="w-full rounded-md border border-gray-300 bg-white p-3 font-mono text-xs leading-relaxed text-gray-800 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          spellCheck={false}
        />
      </section>
    </div>
  );
}
