import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  amountsHidden: boolean;
  toggleAmountsHidden: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      amountsHidden: false,
      toggleAmountsHidden: () =>
        set((s) => ({ amountsHidden: !s.amountsHidden })),
    }),
    { name: 'finance-tracker:ui-prefs' },
  ),
);
