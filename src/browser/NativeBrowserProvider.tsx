import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { BookmarkProvider } from '../../vendor/shared/browser/bookmarks/context';
import type { BookmarkChannel } from '../../vendor/shared/browser/bookmarks/channel';
import { MappingPreview } from '../chat/portMapping/MappingPreview';
import { mappingBrowserUrl } from '../chat/portMapping/useMappingBrowser';
import { NativeBrowserContext } from './context';
import type { BrowserDevice } from './browserMappings';

const bookmarkStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
};

/** One retained browsing context keeps session storage and navigation alive between entry points. */
export function NativeBrowserProvider({ scope, channel, children, devices = [] }: {
  scope: string; channel?: BookmarkChannel; children: ReactNode; devices?: readonly BrowserDevice[];
}) {
  const key = `remoteai:browser-last-url:${scope}`;
  const [initialUrl] = useState(() => {
    try { return mappingBrowserUrl(Storage.getItemSync(key) ?? '') ?? ''; }
    catch { return ''; }
  });
  const [visited, setVisited] = useState(false);
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState<{ url: string }>();
  const open = useCallback((url?: string) => {
    Keyboard.dismiss();
    if (url) setRequest({ url });
    setVisited(true); setVisible(true);
  }, []);
  const context = useMemo(() => ({ open }), [open]);
  const saveUrl = useCallback((url: string) => {
    try { Storage.setItemSync(key, url); }
    catch { /* A last-page hint must not interrupt an otherwise usable browser. */ }
  }, [key]);
  return <NativeBrowserContext.Provider value={context}>
    <BookmarkProvider scope={scope} channel={channel} storage={bookmarkStorage}>
      <View style={styles.root}>
        <View style={styles.root} collapsable={false} accessibilityElementsHidden={visible}
          pointerEvents={visible ? 'none' : 'auto'}
          importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
        {visited && <View style={[StyleSheet.absoluteFill, !visible && styles.hidden]} collapsable={false}
          pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
          <MappingPreview initialUrl={initialUrl} request={request} visible={visible} devices={devices}
            onNavigate={saveUrl} close={() => { Keyboard.dismiss(); setVisible(false); }} />
        </View>}
      </View>
    </BookmarkProvider>
  </NativeBrowserContext.Provider>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, hidden: { opacity: 0 } });
