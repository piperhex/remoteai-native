import type { DirectoryStorage } from '../../../vendor/shared/chat/directory/storage';
import type { AuthSession } from '../../types';
import { withCache } from './database';
import { accountScope } from './store';

export function nativeDirectoryStorage(session: Pick<AuthSession, 'baseUrl' | 'email'>,
  deviceId: string): DirectoryStorage {
  const scope = JSON.stringify([accountScope(session), deviceId, 1]);
  const prepare = () => withCache(async db => {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS directory_cache (
      scope TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (scope, id))`);
  });
  return {
    read: async key => {
      await prepare();
      return withCache(async db => (await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM directory_cache WHERE scope = ? AND id = ?', [scope, key]))?.value ?? null);
    },
    write: async (key, value) => {
      await prepare();
      await withCache(db => db.runAsync('INSERT OR REPLACE INTO directory_cache (scope, id, value) VALUES (?, ?, ?)',
        [scope, key, value]));
    },
  };
}
