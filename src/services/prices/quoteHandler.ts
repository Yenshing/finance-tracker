/**
 * Server-side quote fetcher. Used by:
 *   - Vite dev middleware (vite.config.ts)
 *   - Cloudflare Pages Function (functions/api/quote.ts)
 *
 * Current provider: Stooq (CSV). PoC scope = US stocks only.
 * Symbols on the wire are already normalized by the client (e.g. "AAPL").
 * Stooq's URL form for US tickers is `<lower>.us`.
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
    return { error: '台股報價尚未支援', status: 501 };
  }
  const stooqSymbol = symbol.toLowerCase().includes('.')
    ? symbol.toLowerCase()
    : `${symbol.toLowerCase()}.us`;

  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    stooqSymbol,
  )}&f=sd2t2c&h&e=csv`;

  let res: Response;
  try {
    res = await fetch(url);
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
  const asOf = parseStooqTimestamp(dateStr, timeStr);

  return {
    symbol: symbol.toUpperCase(),
    price,
    currency: 'USD',
    asOf,
  };
}

function parseStooqTimestamp(date: string, time: string): number {
  const iso = `${date}T${time}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}
