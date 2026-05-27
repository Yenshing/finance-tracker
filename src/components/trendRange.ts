export type RangeKey = '3M' | '6M' | '1Y' | '5Y' | 'ALL';

export const DAYS_BY_RANGE: Record<RangeKey, number | null> = {
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '5Y': 365 * 5,
  ALL: null,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  '3M': '近 3 個月',
  '6M': '近 6 個月',
  '1Y': '近 1 年',
  '5Y': '近 5 年',
  ALL: '全部',
};
