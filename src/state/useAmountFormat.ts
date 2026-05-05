import { formatCurrency } from '../lib/formatCurrency';
import { useUiStore } from './uiPreferences';

export const HIDDEN = '****';

export function useAmountsHidden(): boolean {
  return useUiStore((s) => s.amountsHidden);
}

export function useFormatMoney() {
  const hidden = useAmountsHidden();
  return (value: number, currency: string): string =>
    hidden ? HIDDEN : formatCurrency(value, currency);
}

export function useFormatQty() {
  const hidden = useAmountsHidden();
  return (value: number): string => (hidden ? HIDDEN : String(value));
}
