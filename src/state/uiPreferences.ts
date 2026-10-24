import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AssetSortMode = 'value_desc' | 'name_asc';

interface UiState {
  amountsHidden: boolean;
  toggleAmountsHidden: () => void;
  assetSort: AssetSortMode;
  setAssetSort: (mode: AssetSortMode) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      amountsHidden: false,
      toggleAmountsHidden: () =>
        set((s) => ({ amountsHidden: !s.amountsHidden })),
      assetSort: 'value_desc',
      setAssetSort: (mode) => set({ assetSort: mode }),
    }),
    { name: 'finance-tracker:ui-prefs' },
  ),
);
