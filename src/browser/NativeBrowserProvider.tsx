import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Keyboard, StatusBar, StyleSheet, View } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { getRandomBytes } from 'expo-crypto';
import { BookmarkProvider } from '../../vendor/shared/browser/bookmarks/context';
import type { BookmarkChannel } from '../../vendor/shared/browser/bookmarks/channel';
import { useMobileBrowserRenderers } from '../../vendor/shared/browser/useMobileBrowserRenderers';
import { MappingPreview } from '../chat/portMapping/MappingPreview';
import { NativeBrowserContext } from './context';
import type { BrowserDevice } from './browserMappings';
import { useNativeBrowserTabs } from './useNativeBrowserTabs';
import { useBrowserSiteData } from './useBrowserSiteData';
import { BrowserTabManager } from './BrowserTabManager';
import { BrowserInspectorDock } from './inspector/BrowserInspectorDock';
import { useBrowserInspector } from './inspector/useBrowserInspector';
import { deriveNativeVaultKey } from './vaultCrypto';
import { nativeVaultKeyStorage } from './vaultKeyStorage';
import { Toast } from '../components/AppToast';
import { downloadManager } from '../downloads/manager';
import type { BrowserDownloadRequest } from '../downloads/browserDownload';
import { t } from '../i18n';
import type { PageDownloadHandlers } from './pageDownloads';

const bookmarkStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
};

/** Tab metadata outlives evicted WebViews so older pages can reopen at their last address. */
export function NativeBrowserProvider({ scope, channel, children, devices = [], footer, active, onActiveChange,
  openDownloads }: {
  scope: string; channel?: BookmarkChannel; children: ReactNode; devices?: readonly BrowserDevice[];
  footer?: ReactNode; active?: boolean; onActiveChange?: (active: boolean) => void;
  openDownloads?: () => void;
}) {
  const browser = useNativeBrowserTabs(scope);
  const [requestedVisible, setVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const visible = active ?? requestedVisible;
  const { resident, releaseBackground } = useMobileBrowserRenderers(browser.activeId, visible);
  useEffect(() => {
    const pressure = AppState.addEventListener('memoryWarning', releaseBackground);
    const background = AppState.addEventListener('change', state => { if (state === 'background') releaseBackground(); });
    return () => { pressure.remove(); background.remove(); };
  }, [releaseBackground]);
  useEffect(() => { if (!visible) setFullscreen(false); }, [visible]);
  const [manager, setManager] = useState(false);
  const { generation, suspended, clearSiteData } = useBrowserSiteData(browser.resetPreviews);
  const [inspectorObscured, setInspectorObscured] = useState(false);
  const inspector = useBrowserInspector(browser.activeId, generation);
  const hideInspectorKeyboard = inspector.hideKeyboard;
  useEffect(() => { if (!visible) hideInspectorKeyboard(); }, [visible, hideInspectorKeyboard]);
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    hideInspectorKeyboard();
  }, [hideInspectorKeyboard]);
  const close = useCallback(() => {
    dismissKeyboard(); setVisible(false); setManager(false); setFullscreen(false); onActiveChange?.(false);
  }, [dismissKeyboard, onActiveChange]);
  const download = (request: BrowserDownloadRequest) => {
    void downloadManager.enqueueBrowser(scope, request)
      .then(() => Toast.success(t('client.downloads.addedToDownloads')))
      .catch(() => Toast.fail(t('client.mobile.downloadFailedTryAgainLater')));
  };
  const pageDownloads: PageDownloadHandlers = {
    begin: metadata => downloadManager.beginBrowserExport(scope, metadata),
    finished: () => Toast.success(t('client.downloads.addedToDownloads')),
    failed: () => Toast.fail(t('client.mobile.downloadFailedTryAgainLater')),
  };
  const hasBottomNavigation = Boolean(footer);
  const reveal = () => {
    dismissKeyboard();
    setManager(false); setVisible(true);
    onActiveChange?.(true);
  };
  const context = useMemo(() => ({ visible, hasBottomNavigation, close,
    tabs: browser.tabs.map(tab => ({ id: tab.id, at: tab.visitedAt ?? 0 })),
    closeTabs: (ids: string[]) => ids.forEach(id => browser.remove(id)),
    clearSiteData,
    open: (url?: string) => { if (url) browser.visit(url); reveal(); },
    openTab: (url: string) => { browser.add(url); reveal(); },
    openResource: (resource: import('./browserTabs').NativeBrowserResource) => {
      browser.add(resource.url, resource); reveal();
    },
  }), [visible, hasBottomNavigation, close, onActiveChange, browser.tabs, clearSiteData]);
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
        <View style={styles.root}>
          <View style={styles.root} collapsable={false} accessibilityElementsHidden={visible}
            pointerEvents={visible ? 'none' : 'auto'}
            importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
          {/* Moving the browser offscreen keeps Android's inspector surface attached and its session alive. */}
          <View style={[styles.browserLayer, !visible && styles.offscreen]} collapsable={false}
            pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
            importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
            <BrowserInspectorDock inspector={inspector} obscured={visible && inspectorObscured}
              fullscreen={visible && fullscreen}>
              {browser.tabs.filter(tab => resident.includes(tab.id)).map(tab => {
                const selected = browser.activeId === tab.id;
                const active = visible && !manager && selected;
                return <View key={tab.id} style={[StyleSheet.absoluteFill, !active && styles.hidden]}
                  collapsable={false} pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active}
                  importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
                  <MappingPreview trustScope={scope} suspended={suspended} initialUrl={tab.url} resource={tab.resource}
                    request={tab.request} onRequestHandled={request => browser.consumeRequest(tab.id, request)}
                    visible={active} devices={devices}
                    onDownload={download} pageDownloads={pageDownloads} openDownloads={openDownloads}
                    inspector={selected ? inspector : undefined} onInspectorObscuredChange={setInspectorObscured}
                    desktop={tab.desktop}
                    onDesktopChange={desktop => browser.update(tab.id, { desktop, preview: undefined })}
                    fullscreen={fullscreen && active} onFullscreenChange={setFullscreen}
                    tabCount={browser.tabs.length} newTab={add}
                    manageTabs={() => { inspector.close(); setManager(true); }}
                    onPreview={preview => browser.setPreview(tab.id, preview)}
                    onNavigate={(url, title) => browser.update(tab.id, {
                      url, title: title || (url === tab.url ? tab.title : ''),
                      visitedAt: url !== tab.url ? Date.now() : tab.visitedAt })} close={close} />
                </View>;
              })}
              {visible && manager && <View style={StyleSheet.absoluteFill}>
                <BrowserTabManager tabs={browser.tabs} activeId={browser.activeId} add={add} remove={remove}
                  closeAll={closeAll} select={id => { Keyboard.dismiss(); browser.select(id); setManager(false); }}
                  close={() => setManager(false)} />
              </View>}
            </BrowserInspectorDock>
          </View>
        </View>
        <View style={visible && fullscreen ? styles.footerHidden : undefined}>{footer}</View>
      </View>
    </BookmarkProvider>
  </NativeBrowserContext.Provider>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  browserLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '100%' },
  offscreen: { left: '100%' },
  hidden: { opacity: 0 },
  footerHidden: { display: 'none' },
});
