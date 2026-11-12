import type { MarketKey } from '../../provider-market/i18n';
import type { BookmarkStatus } from './store';

export const bookmarkStatusKeys: Record<BookmarkStatus, MarketKey> = {
  local: 'market.bookmarkLocal', syncing: 'market.bookmarkSyncing', synced: 'market.bookmarkSynced',
  offline: 'market.bookmarkSyncFailed', 'storage-error': 'market.bookmarkStorageFailed', capacity: 'market.bookmarkCapacity',
};
