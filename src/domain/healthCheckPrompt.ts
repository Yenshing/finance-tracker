import type { AssetView } from './portfolio';
import { BROKER_BY_CODE } from './brokers';
import { CRYPTO_BY_ID } from './cryptos';

export type HealthScope = 'all' | 'us_stock' | 'tw_stock';

const SCOPE_LABELS: Record<HealthScope, string> = {
  all: '全部投資',
  us_stock: '美元股票',
  tw_stock: '台灣股票',
};

type Bucket = 'us_stock' | 'tw_stock' | 'crypto' | 'other';

const BUCKET_LABELS: Record<Bucket, string> = {
  us_stock: '美元股票',
  tw_stock: '台灣股票',
  crypto: '加密貨幣',
  other: '其他',
};

function bucketOf(v: AssetView): Bucket {
  const t = v.asset.type;
  if (t === 'stock') {
    return v.asset.broker === 'tw_broker' ? 'tw_stock' : 'us_stock';
  }
  if (t === 'crypto') return 'crypto';
  return 'other';
}

function isUsStock(v: AssetView): boolean {
  return v.asset.type === 'stock' && v.asset.broker !== 'tw_broker';
}
function isTwStock(v: AssetView): boolean {
  return v.asset.type === 'stock' && v.asset.broker === 'tw_broker';
}

function displayName(v: AssetView): string {
  if (v.asset.type === 'crypto' && v.asset.symbol) {
    return CRYPTO_BY_ID[v.asset.symbol]?.name ?? v.asset.name;
  }
  return v.asset.name;
}

function displaySymbol(v: AssetView): string {
  if (v.asset.type === 'crypto' && v.asset.symbol) {
    return CRYPTO_BY_ID[v.asset.symbol]?.symbol ?? v.asset.symbol;
  }
  return v.asset.symbol ?? '—';
}

function todayDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildHealthCheckPrompt(
  investmentItems: AssetView[],
  scope: HealthScope,
): string {
  let scoped: AssetView[];
  if (scope === 'us_stock') scoped = investmentItems.filter(isUsStock);
  else if (scope === 'tw_stock') scoped = investmentItems.filter(isTwStock);
  else scoped = [...investmentItems];

  scoped = scoped.filter(
    (v) => v.valueInBase !== null && (v.valueInBase ?? 0) > 0,
  );
  scoped.sort((a, b) => (b.valueInBase ?? 0) - (a.valueInBase ?? 0));

  if (scoped.length === 0) {
    return `（${SCOPE_LABELS[scope]}範圍下沒有可分析的資產，請先到「資產」頁新增資料。）`;
  }

  const scopeTotal = scoped.reduce((s, v) => s + (v.valueInBase ?? 0), 0);
  const lines: string[] = [];

  lines.push(
    `我目前的${SCOPE_LABELS[scope] === '全部投資' ? '投資組合' : SCOPE_LABELS[scope]}配置如下，請從資產配置與風險分散的角度幫我做健檢。`,
  );
  lines.push('');
  lines.push(`【分析範圍】${SCOPE_LABELS[scope]}`);
  lines.push(`【資料時間】${todayDateString()}`);
  lines.push('');

  if (scope === 'all') {
    const bucketTotals: Record<Bucket, number> = {
      us_stock: 0,
      tw_stock: 0,
      crypto: 0,
      other: 0,
    };
    for (const v of scoped) {
      bucketTotals[bucketOf(v)] += v.valueInBase ?? 0;
    }

    const headers = ['類別', '標的', '代號', '區內佔比', '範圍佔比'];
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

    for (const v of scoped) {
      const bucket = bucketOf(v);
      const innerTotal = bucketTotals[bucket];
      const innerPct = innerTotal > 0 ? ((v.valueInBase ?? 0) / innerTotal) * 100 : 0;
      const scopePct = ((v.valueInBase ?? 0) / scopeTotal) * 100;
      const cells = [
        BUCKET_LABELS[bucket],
        displayName(v),
        displaySymbol(v),
        `${innerPct.toFixed(1)}%`,
        `${scopePct.toFixed(1)}%`,
      ];
      lines.push(`| ${cells.join(' | ')} |`);
    }

    lines.push('');
    lines.push('【子類別小計】');
    const buckets: Bucket[] = ['us_stock', 'tw_stock', 'crypto', 'other'];
    for (const b of buckets) {
      if (bucketTotals[b] <= 0) continue;
      const pct = (bucketTotals[b] / scopeTotal) * 100;
      lines.push(`- ${BUCKET_LABELS[b]}：${pct.toFixed(1)}%`);
    }
  } else {
    const headers: string[] = ['標的', '代號'];
    if (scope === 'us_stock') headers.push('券商類型');
    headers.push('範圍佔比');

    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

    for (const v of scoped) {
      const scopePct = ((v.valueInBase ?? 0) / scopeTotal) * 100;
      const cells: string[] = [displayName(v), displaySymbol(v)];
      if (scope === 'us_stock') {
        const broker = v.asset.broker ? BROKER_BY_CODE[v.asset.broker] : null;
        cells.push(broker?.label ?? '—');
      }
      cells.push(`${scopePct.toFixed(1)}%`);
      lines.push(`| ${cells.join(' | ')} |`);
    }
  }

  lines.push('');
  lines.push('請分析：');
  lines.push('1. 單一持股集中度（特別是 > 30% 的部位）');
  lines.push('2. 產業 / 地區分散是否合理');
  lines.push('3. 主要風險點');
  lines.push('4. 具體改善建議');

  return lines.join('\n');
}
