import type { MarketKey } from '../../provider-market/i18n';
import type { DataStatus } from './store';
import type { TimeRange } from './model';
export const dataStatusKeys: Record<DataStatus, MarketKey> = {
  local: 'market.browserDataLocal', syncing: 'market.browserDataSyncing', synced: 'market.browserDataSynced',
  offline: 'market.browserDataOffline', 'storage-error': 'market.browserDataStorage',
  conflict: 'market.browserDataConflict', capacity: 'market.browserDataCapacity',
};
export const rangeKeys: Record<TimeRange, MarketKey> = {
  hour: 'market.browserDataHour', day: 'market.browserDataDay', week: 'market.browserDataWeek',
  month: 'market.browserDataMonth', all: 'market.browserDataAll',
};
export const categoryKeys = {
  history: 'market.browserDataHistory', cookies: 'market.browserDataCookies', cache: 'market.browserDataCache',
  tabs: 'market.browserDataTabs', passwords: 'market.browserDataPasswords',
} as const;
export type DataCategory = keyof typeof categoryKeys;
export const categoryHints: Partial<Record<DataCategory, MarketKey>> = {
  cookies: 'market.browserDataCookiesHint', cache: 'market.browserDataCacheHint',
  tabs: 'market.browserDataTabsHint', passwords: 'market.browserDataPasswordHint',
};
