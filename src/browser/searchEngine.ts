import Storage from 'expo-sqlite/kv-store';
import { SearchPreference } from '../../vendor/shared/browser/searchPreference';
import { useSearchEngine } from '../../vendor/shared/browser/useSearchEngine';

let preference: SearchPreference | undefined;
export function useNativeSearchEngine() {
  preference ??= new SearchPreference({ getItem: key => Storage.getItemSync(key),
    setItem: (key, value) => Storage.setItemSync(key, value) });
  return useSearchEngine(preference);
}
