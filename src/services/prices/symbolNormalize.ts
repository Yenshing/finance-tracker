export type Market = 'US' | 'TW';

export interface MarketMeta {
  code: Market;
  label: string;
  currency: string;
  suffix: string;
  hint: string;
  pad?: number;
}

export const MARKETS: MarketMeta[] = [
  { code: 'US', label: '美股', currency: 'USD', suffix: '', hint: '例：AAPL' },
  { code: 'TW', label: '台股', currency: 'TWD', suffix: '.TW', hint: '例：2330' },
];

export const MARKET_BY_CODE: Record<Market, MarketMeta> = Object.fromEntries(
  MARKETS.map((m) => [m.code, m]),
) as Record<Market, MarketMeta>;

export function normalizeSymbol(rawInput: string, market: Market): string {
  const meta = MARKET_BY_CODE[market];
  let raw = rawInput.trim().toUpperCase();
  if (!raw) return '';
  if (meta.suffix && raw.endsWith(meta.suffix)) {
    raw = raw.slice(0, -meta.suffix.length);
  }
  if (meta.pad) raw = raw.padStart(meta.pad, '0');
  return `${raw}${meta.suffix}`;
}

export function parseSymbol(symbol: string): { market: Market; raw: string } {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.TW')) return { market: 'TW', raw: upper.slice(0, -3) };
  return { market: 'US', raw: upper };
}
