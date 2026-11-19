import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, StatusBar, StyleSheet, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { getRandomBytes } from 'expo-crypto';
import { BookmarkProvider } from '../../vendor/shared/browser/bookmarks/context';
import type { BookmarkChannel } from '../../vendor/shared/browser/bookmarks/channel';
import { MappingPreview } from '../chat/portMapping/MappingPreview';
import { NativeBrowserContext } from './context';
import type { BrowserDevice } from './browserMappings';
import { useNativeBrowserTabs } from './useNativeBrowserTabs';
import { BrowserTabManager } from './BrowserTabManager';
import { BrowserInspectorDock } from './inspector/BrowserInspectorDock';
import { useBrowserInspector } from './inspector/useBrowserInspector';
import { useBrowserBack } from './useBrowserNavigationGestures';
import { deriveNativeVaultKey } from './vaultCrypto';
import { nativeVaultKeyStorage } from './vaultKeyStorage';
import { Toast } from '../components/AppToast';
import { downloadManager } from '../downloads/manager';
import type { BrowserDownloadRequest } from '../downloads/browserDownload';
import { t } from '../i18n';

const bookmarkStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
};

/** Each tab owns a retained browsing context, including session storage and native navigation history. */
export function NativeBrowserProvider({ scope, channel, children, devices = [], footer, active, onActiveChange,
  openDownloads }: {
  scope: string; channel?: BookmarkChannel; children: ReactNode; devices?: readonly BrowserDevice[];
  footer?: ReactNode; active?: boolean; onActiveChange?: (active: boolean) => void;
  openDownloads?: () => void;
}) {
  const browser = useNativeBrowserTabs(scope);
  const [visited, setVisited] = useState(false);
  const [requestedVisible, setVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const visible = active ?? requestedVisible;
  useEffect(() => { if (visible) setVisited(true); }, [visible]);
  useEffect(() => { if (!visible) setFullscreen(false); }, [visible]);
  const [manager, setManager] = useState(false);
  const [dataGeneration, setDataGeneration] = useState(0);
  const [inspectorObscured, setInspectorObscured] = useState(false);
  const inspector = useBrowserInspector(browser.activeId, dataGeneration);
  const hideInspectorKeyboard = inspector.hideKeyboard;
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    hideInspectorKeyboard();
  }, [hideInspectorKeyboard]);
  useBrowserBack(!visible && inspector.open, inspector.close, dismissKeyboard);
  const close = useCallback(() => {
    dismissKeyboard(); setVisible(false); setManager(false); setFullscreen(false); onActiveChange?.(false);
  }, [dismissKeyboard, onActiveChange]);
  const download = (request: BrowserDownloadRequest) => {
    void downloadManager.enqueueBrowser(scope, request)
      .then(() => Toast.success(t('client.downloads.addedToDownloads')))
      .catch(() => Toast.fail(t('client.mobile.downloadFailedTryAgainLater')));
  };
  const hasBottomNavigation = Boolean(footer);
  const reveal = () => {
    dismissKeyboard();
    setManager(false); setVisited(true); setVisible(true);
    onActiveChange?.(true);
  };
  const context = useMemo(() => ({ visible, hasBottomNavigation, close,
    tabs: browser.tabs.map(tab => ({ id: tab.id, at: tab.visitedAt ?? 0 })),
    closeTabs: (ids: string[]) => ids.forEach(id => browser.remove(id)),
    reloadTabs: () => setDataGeneration(value => value + 1),
    open: (url?: string) => { if (url) browser.visit(url); reveal(); },
    openTab: (url: string) => { browser.add(url); reveal(); },
    openResource: (resource: import('./browserTabs').NativeBrowserResource) => {
      browser.add(resource.url, resource); reveal();
    },
  }), [visible, hasBottomNavigation, close, onActiveChange, browser.tabs]);
  const add = () => { Keyboard.dismiss(); browser.add(); setManager(false); };
  const remove = (id: string) => {
    browser.remove(id);
    if (browser.tabs.length === 1 && browser.tabs[0].id === id) {
      Keyboard.dismiss(); setManager(false); setFullscreen(false);
    }
  };
  const closeAll = () => {
    Keyboard.dismiss(); browser.closeAll(); setManager(false); setFullscreen(false);
  };
  return <NativeBrowserContext.Provider value={context}>
    <BookmarkProvider scope={scope} channel={channel} storage={bookmarkStorage} random={getRandomBytes}
      derive={deriveNativeVaultKey} keyStorage={nativeVaultKeyStorage}>
      <View style={styles.root}>
      {visible && fullscreen && <StatusBar hidden />}
      <BrowserInspectorDock inspector={inspector} obscured={visible && inspectorObscured}
        fullscreen={visible && fullscreen}>
        <View style={styles.root} collapsable={false} accessibilityElementsHidden={visible}
          pointerEvents={visible ? 'none' : 'auto'}
          importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
        {visited && browser.tabs.map(tab => {
          const selected = browser.activeId === tab.id;
          const active = visible && !manager && selected;
          return <View key={tab.id} style={[StyleSheet.absoluteFill, !active && styles.hidden]} collapsable={false}
            pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
            <MappingPreview dataGeneration={dataGeneration} initialUrl={tab.url} resource={tab.resource}
              request={tab.request} visible={active} devices={devices}
              onDownload={download} openDownloads={openDownloads}
              inspector={selected ? inspector : undefined} onInspectorObscuredChange={setInspectorObscured}
              desktop={tab.desktop} onDesktopChange={desktop => browser.update(tab.id, { desktop, preview: undefined })}
              fullscreen={fullscreen && active} onFullscreenChange={setFullscreen}
              tabCount={browser.tabs.length} newTab={add} manageTabs={() => { inspector.close(); setManager(true); }}
              onPreview={preview => browser.update(tab.id, { preview })}
              onNavigate={(url, title) => browser.update(tab.id, { url, title,
                visitedAt: url !== tab.url ? Date.now() : tab.visitedAt })} close={close} />
          </View>;
        })}
        {visible && manager && <View style={StyleSheet.absoluteFill}>
          <BrowserTabManager tabs={browser.tabs} activeId={browser.activeId} add={add} remove={remove} closeAll={closeAll}
            select={id => { Keyboard.dismiss(); browser.select(id); setManager(false); }} close={() => setManager(false)} />
        </View>}
      </BrowserInspectorDock>
      <View style={visible && fullscreen ? styles.footerHidden : undefined}>{footer}</View>
      </View>
    </BookmarkProvider>
  </NativeBrowserContext.Provider>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, hidden: { opacity: 0 }, footerHidden: { display: 'none' } });
