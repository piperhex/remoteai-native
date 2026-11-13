import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { BookmarkProvider } from '../../vendor/shared/browser/bookmarks/context';
import type { BookmarkChannel } from '../../vendor/shared/browser/bookmarks/channel';
import { MappingPreview } from '../chat/portMapping/MappingPreview';
import { NativeBrowserContext } from './context';
import type { BrowserDevice } from './browserMappings';
import { useNativeBrowserTabs } from './useNativeBrowserTabs';
import { BrowserTabManager } from './BrowserTabManager';

const bookmarkStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
};

/** Each tab owns a retained browsing context, including session storage and native navigation history. */
export function NativeBrowserProvider({ scope, channel, children, devices = [], footer, active, onActiveChange }: {
  scope: string; channel?: BookmarkChannel; children: ReactNode; devices?: readonly BrowserDevice[];
  footer?: ReactNode; active?: boolean; onActiveChange?: (active: boolean) => void;
}) {
  const browser = useNativeBrowserTabs(scope);
  const [visited, setVisited] = useState(false);
  const [requestedVisible, setVisible] = useState(false);
  const visible = active ?? requestedVisible;
  const [manager, setManager] = useState(false);
  const close = useCallback(() => {
    Keyboard.dismiss(); setVisible(false); setManager(false); onActiveChange?.(false);
  }, [onActiveChange]);
  const hasBottomNavigation = Boolean(footer);
  const reveal = () => {
    Keyboard.dismiss();
    setManager(false); setVisited(true); setVisible(true);
    onActiveChange?.(true);
  };
  const context = useMemo(() => ({ visible, hasBottomNavigation, close,
    open: (url?: string) => { if (url) browser.visit(url); reveal(); },
    openTab: (url: string) => { browser.add(url); reveal(); },
    openResource: (resource: import('./browserTabs').NativeBrowserResource) => {
      browser.add(resource.url, resource); reveal();
    },
  }), [visible, hasBottomNavigation, close, onActiveChange]);
  const add = () => { Keyboard.dismiss(); browser.add(); setManager(false); };
  return <NativeBrowserContext.Provider value={context}>
    <BookmarkProvider scope={scope} channel={channel} storage={bookmarkStorage}>
      <View style={styles.root}>
      <View style={styles.root}>
        <View style={styles.root} collapsable={false} accessibilityElementsHidden={visible}
          pointerEvents={visible ? 'none' : 'auto'}
          importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
        {visited && browser.tabs.map(tab => {
          const active = visible && !manager && browser.activeId === tab.id;
          return <View key={tab.id} style={[StyleSheet.absoluteFill, !active && styles.hidden]} collapsable={false}
            pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
            <MappingPreview initialUrl={tab.url} resource={tab.resource} request={tab.request}
              visible={active} devices={devices}
              desktop={tab.desktop} onDesktopChange={desktop => browser.update(tab.id, { desktop, preview: undefined })}
              tabCount={browser.tabs.length} newTab={add} manageTabs={() => setManager(true)}
              onPreview={preview => browser.update(tab.id, { preview })}
              onNavigate={(url, title) => browser.update(tab.id, { url, title })} close={close} />
          </View>;
        })}
        {visible && manager && <View style={StyleSheet.absoluteFill}>
          <BrowserTabManager tabs={browser.tabs} activeId={browser.activeId} add={add} remove={browser.remove}
            select={id => { Keyboard.dismiss(); browser.select(id); setManager(false); }} close={() => setManager(false)} />
        </View>}
      </View>
      {footer}
      </View>
    </BookmarkProvider>
  </NativeBrowserContext.Provider>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, hidden: { opacity: 0 } });
