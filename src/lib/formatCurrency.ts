export function formatCurrency(value: number, currency: string, locale = 'zh-TW'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString(locale)}`;
  }
}

export function formatCurrencyDecimal(
  value: number,
  currency: string,
  locale = 'zh-TW',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(locale)}`;
  }
}
