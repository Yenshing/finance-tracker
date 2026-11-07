/**
 * Server-side quote fetcher. Used by:
 *   - Vite dev middleware (vite.config.ts)
 *   - Cloudflare Pages Function (functions/api/quote.ts)
 *
 * Providers:
 *   - US (default): Yahoo Finance chart API (latest regular-market price);
 *     falls back to Stooq CSV if Yahoo fails.
 *   - TW (`.TW` suffix): TWSE OpenAPI (listed, bulk daily close), then TPEx
 *     OpenAPI (OTC), then the legacy TWSE STOCK_DAY endpoint as a last resort.
 *     www.twse.com.tw round-robins across many backends and some of them never
 *     answer, so every TW request carries a timeout.
 *
 * Neither TWSE nor TPEx return CORS headers, so the browser must call us — not them.
 */

export interface QuoteResponse {
  symbol: string;
  price: number;
  currency: string;
  asOf: number; // ms epoch
}

export interface QuoteError {
  error: string;
  status: number;
}

export async function fetchQuote(symbol: string): Promise<QuoteResponse | QuoteError> {
  if (!symbol || !/^[A-Z0-9.\-]{1,15}$/i.test(symbol)) {
    return { error: 'invalid symbol', status: 400 };
  }
  if (symbol.toUpperCase().endsWith('.TW')) {
    return fetchTaiwanQuote(symbol);
  }
  const yahoo = await fetchYahooQuote(symbol);
  if (!('error' in yahoo) || yahoo.status === 404) return yahoo;
  const stooq = await fetchStooqQuote(symbol);
  return 'error' in stooq ? yahoo : stooq;
}

const UPSTREAM_TIMEOUT_MS = 8000;

interface YahooChartEnvelope {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number; // s epoch
      };
    }> | null;
    error?: { code?: string; description?: string } | null;
  };
}

async function fetchYahooQuote(symbol: string): Promise<QuoteResponse | QuoteError> {
  // Yahoo uses "-" for share classes (BRK.B → BRK-B).
  const yahooSymbol = symbol.toUpperCase().replace(/\./g, '-');
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?range=1d&interval=1d`;

  let res: Response;
  try {
    res = await fetch(url, {
      // Yahoo answers 429 to requests without a browser-like User-Agent.
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    return { error: `Yahoo network: ${(e as Error).message}`, status: 502 };
  }
  if (res.status === 404) {
    return { error: 'symbol not found', status: 404 };
  }
  if (!res.ok) {
    return { error: `Yahoo upstream ${res.status}`, status: 502 };
  }
  let body: YahooChartEnvelope;
  try {
    body = (await res.json()) as YahooChartEnvelope;
  } catch {
    return { error: 'Yahoo JSON parse failed', status: 502 };
  }
  const meta = body.chart?.result?.[0]?.meta;
  if (!meta) {
    return { error: 'symbol not found', status: 404 };
  }
  const price = meta.regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return { error: 'Yahoo unparseable price', status: 502 };
  }
  return {
    symbol: symbol.toUpperCase(),
    price,
    currency: meta.currency ?? 'USD',
    asOf: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
  };
}

async function fetchStooqQuote(symbol: string): Promise<QuoteResponse | QuoteError> {
  const stooqSymbol = symbol.toLowerCase().includes('.')
    ? symbol.toLowerCase()
    : `${symbol.toLowerCase()}.us`;

  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    stooqSymbol,
  )}&f=sd2t2c&h&e=csv`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (e) {
    return { error: `network: ${(e as Error).message}`, status: 502 };
  }
  if (!res.ok) {
    return { error: `upstream ${res.status}`, status: 502 };
  }

  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    return { error: 'empty upstream response', status: 502 };
  }
  const cols = lines[1].split(',');
  if (cols.length < 4) {
    return { error: 'malformed CSV', status: 502 };
  }
  const [, dateStr, timeStr, closeStr] = cols;
  if (closeStr === 'N/D' || dateStr === 'N/D') {
    return { error: 'symbol not found', status: 404 };
  }
  const price = Number(closeStr);
  if (!Number.isFinite(price)) {
    return { error: 'unparseable price', status: 502 };
  }
  const asOf = parseIsoUtc(`${dateStr}T${timeStr}Z`);

  return {
    symbol: symbol.toUpperCase(),
    price,
    currency: 'USD',
    asOf,
  };
}

async function fetchTaiwanQuote(symbol: string): Promise<QuoteResponse | QuoteError> {
  const code = symbol.toUpperCase().replace(/\.TW$/, '');
  if (!/^[0-9A-Z]{3,6}$/.test(code)) {
    return { error: 'invalid TW code', status: 400 };
  }

  const openapi = await fetchFromTwseOpenApi(code);
  if (openapi.kind === 'ok') return openapi.value;

  const tpex = await fetchFromTpex(code);
  if (tpex.kind === 'ok') return tpex.value;

  // Both daily lists loaded and neither has the code: treat as unknown symbol.
  if (openapi.kind === 'not_found' && tpex.kind === 'not_found') {
    return { error: 'symbol not found on TWSE or TPEx', status: 404 };
  }

  // A list failed to load or had no usable price (e.g. suspended): last resort.
  const twse = await fetchFromTwse(code);
  if (twse.kind === 'ok') return twse.value;
  if (openapi.kind === 'fatal') return openapi.error;
  if (tpex.kind === 'fatal') return tpex.error;
  if (twse.kind === 'fatal') return twse.error;

  return { error: 'symbol not found on TWSE or TPEx', status: 404 };
}

type TaiwanFetchOutcome =
  | { kind: 'ok'; value: QuoteResponse }
  | { kind: 'not_found' }
  | { kind: 'fatal'; error: QuoteError };

interface TwseEnvelope {
  stat?: string;
  fields?: string[];
  data?: string[][];
}

interface TwseOpenApiRow {
  Date?: string;
  Code?: string;
  ClosingPrice?: string;
}

interface TwseOpenApiCache {
  byCode: Map<string, TwseOpenApiRow>;
  fetchedAt: number;
}
let twseOpenApiCache: TwseOpenApiCache | null = null;

async function getTwseOpenApiAll(): Promise<TwseOpenApiCache | { error: QuoteError }> {
  if (twseOpenApiCache && Date.now() - twseOpenApiCache.fetchedAt < TPEX_CACHE_MS) {
    return twseOpenApiCache;
  }
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    return { error: { error: `TWSE OpenAPI network: ${(e as Error).message}`, status: 502 } };
  }
  if (!res.ok) {
    return { error: { error: `TWSE OpenAPI upstream ${res.status}`, status: 502 } };
  }
  let rows: TwseOpenApiRow[];
  try {
    rows = (await res.json()) as TwseOpenApiRow[];
  } catch {
    return { error: { error: 'TWSE OpenAPI JSON parse failed', status: 502 } };
  }
  if (!Array.isArray(rows)) {
    return { error: { error: 'TWSE OpenAPI unexpected shape', status: 502 } };
  }
  const byCode = new Map<string, TwseOpenApiRow>();
  for (const row of rows) {
    if (row.Code) byCode.set(row.Code, row);
  }
  twseOpenApiCache = { byCode, fetchedAt: Date.now() };
  return twseOpenApiCache;
}

async function fetchFromTwseOpenApi(code: string): Promise<TaiwanFetchOutcome> {
  const cache = await getTwseOpenApiAll();
  if ('error' in cache) {
    return { kind: 'fatal', error: cache.error };
  }
  const row = cache.byCode.get(code);
  if (!row) return { kind: 'not_found' };
  const price = Number((row.ClosingPrice ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(price) || price <= 0) {
    // e.g. suspended / no trade today — let the legacy endpoint find the last close.
    return { kind: 'fatal', error: { error: 'TWSE OpenAPI unparseable price', status: 502 } };
  }
  const asOf = parseRocCompactDate(row.Date ?? '') ?? Date.now();
  return {
    kind: 'ok',
    value: { symbol: `${code}.TW`, price, currency: 'TWD', asOf },
  };
}

async function fetchFromTwse(code: string): Promise<TaiwanFetchOutcome> {
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${encodeURIComponent(
    code,
  )}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    return { kind: 'fatal', error: { error: `TWSE network: ${(e as Error).message}`, status: 502 } };
  }
  if (!res.ok) {
    return { kind: 'fatal', error: { error: `TWSE upstream ${res.status}`, status: 502 } };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: 'fatal', error: { error: 'TWSE JSON parse failed', status: 502 } };
  }
  const env = body as TwseEnvelope;
  if (env.stat !== 'OK' || !Array.isArray(env.data) || env.data.length === 0) {
    return { kind: 'not_found' };
  }
  const fields = env.fields ?? [];
  const closeIdx = fields.indexOf('收盤價');
  if (closeIdx < 0) {
    return { kind: 'fatal', error: { error: 'TWSE missing 收盤價 field', status: 502 } };
  }
  const lastRow = env.data[env.data.length - 1];
  const closeStr = (lastRow[closeIdx] ?? '').replace(/,/g, '').trim();
  const price = Number(closeStr);
  if (!Number.isFinite(price) || price <= 0) {
    return { kind: 'fatal', error: { error: 'TWSE unparseable price', status: 502 } };
  }
  const asOf = parseRocDate(lastRow[0] ?? '') ?? Date.now();
  return {
    kind: 'ok',
    value: { symbol: `${code}.TW`, price, currency: 'TWD', asOf },
  };
}

interface TpexRow {
  Date?: string;
  SecuritiesCompanyCode?: string;
  CompanyName?: string;
  Close?: string;
}

interface TpexCache {
  byCode: Map<string, TpexRow>;
  fetchedAt: number;
}
const TPEX_CACHE_MS = 5 * 60 * 1000;
let tpexCache: TpexCache | null = null;

async function getTpexAll(): Promise<TpexCache | { error: QuoteError }> {
  if (tpexCache && Date.now() - tpexCache.fetchedAt < TPEX_CACHE_MS) {
    return tpexCache;
  }
  const url = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    return { error: { error: `TPEx network: ${(e as Error).message}`, status: 502 } };
  }
  if (!res.ok) {
    return { error: { error: `TPEx upstream ${res.status}`, status: 502 } };
  }
  let rows: TpexRow[];
  try {
    rows = (await res.json()) as TpexRow[];
  } catch {
    return { error: { error: 'TPEx JSON parse failed', status: 502 } };
  }
  if (!Array.isArray(rows)) {
    return { error: { error: 'TPEx unexpected shape', status: 502 } };
  }
  const byCode = new Map<string, TpexRow>();
  for (const row of rows) {
    if (row.SecuritiesCompanyCode) byCode.set(row.SecuritiesCompanyCode, row);
  }
  tpexCache = { byCode, fetchedAt: Date.now() };
  return tpexCache;
}

async function fetchFromTpex(code: string): Promise<TaiwanFetchOutcome> {
  const cache = await getTpexAll();
  if ('error' in cache) {
    return { kind: 'fatal', error: cache.error };
  }
  const row = cache.byCode.get(code);
  if (!row) return { kind: 'not_found' };
  const closeStr = (row.Close ?? '').replace(/,/g, '').trim();
  const price = Number(closeStr);
  if (!Number.isFinite(price) || price <= 0) {
    return { kind: 'fatal', error: { error: 'TPEx unparseable price', status: 502 } };
  }
  const asOf = parseRocCompactDate(row.Date ?? '') ?? Date.now();
  return {
    kind: 'ok',
    value: { symbol: `${code}.TW`, price, currency: 'TWD', asOf },
  };
}

function parseRocDate(roc: string): number | null {
  // "115/05/04" → 2026-05-04 close-of-day in Asia/Taipei (UTC+8).
  const m = /^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/.exec(roc.trim());
  if (!m) return null;
  return rocPartsToEpoch(Number(m[1]), Number(m[2]), Number(m[3]));
}

function parseRocCompactDate(roc: string): number | null {
  // "1150504" (TPEx format) → 2026-05-04
  const m = /^(\d{3})(\d{2})(\d{2})$/.exec(roc.trim());
  if (!m) return null;
  return rocPartsToEpoch(Number(m[1]), Number(m[2]), Number(m[3]));
}

function rocPartsToEpoch(rocYear: number, month: number, day: number): number | null {
  const year = 1911 + rocYear;
  // 13:30 Asia/Taipei (UTC+8) ≒ 05:30 UTC for close-of-day timestamp.
  const iso = `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T05:30:00Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function parseIsoUtc(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}
