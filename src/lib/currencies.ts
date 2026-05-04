export interface CurrencyMeta {
  code: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'TWD', label: '新台幣 (TWD)' },
  { code: 'USD', label: '美元 (USD)' },
  { code: 'JPY', label: '日圓 (JPY)' },
  { code: 'HKD', label: '港幣 (HKD)' },
  { code: 'CNY', label: '人民幣 (CNY)' },
  { code: 'EUR', label: '歐元 (EUR)' },
  { code: 'GBP', label: '英鎊 (GBP)' },
];
