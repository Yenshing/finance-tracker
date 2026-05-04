export interface CurrencyMeta {
  code: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'TWD', label: '新台幣 (TWD)' },
  { code: 'USD', label: '美元 (USD)' },
];

export const FX_BASE = 'USD';
export const FX_PEERS = ['TWD'] as const;
