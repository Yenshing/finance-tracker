import type { AssetType, Category } from '../db/types';

export interface CategoryMeta {
  key: Category;
  label: string;
  description: string;
  hex: string;
  defaultTypes: AssetType[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    key: 'liquid',
    label: '流動資金',
    description: '現金、銀行存款、電子錢包',
    hex: '#3b82f6',
    defaultTypes: ['cash', 'custom'],
  },
  {
    key: 'investment',
    label: '投資',
    description: '股票、加密貨幣、基金',
    hex: '#10b981',
    defaultTypes: ['stock', 'crypto', 'custom'],
  },
  {
    key: 'fixed',
    label: '固定資產',
    description: '房產、汽車、貴重物品',
    hex: '#f59e0b',
    defaultTypes: ['real_estate', 'vehicle', 'custom'],
  },
];

export const VALID_CATEGORY_KEYS = new Set<Category>(CATEGORIES.map((c) => c.key));

export const CATEGORY_BY_KEY: Record<Category, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<Category, CategoryMeta>;

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash: '現金 / 銀行',
  stock: '股票',
  crypto: '加密貨幣',
  real_estate: '房產',
  vehicle: '車輛',
  custom: '其他',
};
