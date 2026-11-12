import { useEffect, useRef, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { t, useLanguage } from '../../i18n';
import { useStyles } from '../styles';
import { MappingBrowserToolbar } from './MappingBrowserToolbar';
import { MappingBrowserSettings } from './MappingBrowserSettings';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import { PREVIEW_NETWORK_SCRIPT } from './previewNetworkActivity';
import { useMappingBrowser } from './useMappingBrowser';
import { BrowserBookmarks } from '../../browser/BrowserBookmarks';
import { BrowserPortMappings } from '../../browser/BrowserPortMappings';
import type { BrowserDevice } from '../../browser/browserMappings';
import { BrowserSearchEngines } from '../../browser/BrowserSearchEngines';
import { useBrowserNavigationGestures } from '../../browser/useBrowserNavigationGestures';

export function MappingPreview({ port, initialUrl = '', request, visible = true, onNavigate, close, devices = [],
  tabCount = 1, newTab = () => {}, manageTabs = () => {}, onPreview }: {
  port?: number; initialUrl?: string; request?: { url: string }; visible?: boolean;
  onNavigate?: (url: string, title: string) => void; close: () => void;
  devices?: readonly BrowserDevice[];
  tabCount?: number; newTab?: () => void; manageTabs?: () => void; onPreview?: (uri: string) => void;
}) {
  const styles = useStyles();
  const browserStyles = useMappingBrowserStyles();
  const browser = useMappingBrowser(port ? `http://127.0.0.1:${port}` : initialUrl);
  const { activity } = browser;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState<'bookmarks' | 'mappings' | 'search'>();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const page = useRef<View>(null);
  const capturing = useRef(false);
  const snapshotThen = async (action: () => void) => {
    if (capturing.current) return;
    Keyboard.dismiss();
    capturing.current = true;
    try {
      if (page.current && browser.currentUrl && onPreview) {
        const data = await captureRef(page, { format: 'jpg', quality: 0.55, width: 320, result: 'base64' });
        onPreview(`data:image/jpeg;base64,${data}`);
      }
    } catch { /* A page may be detached or protected; the tab still remains available without a thumbnail. */ }
    finally { capturing.current = false; action(); }
  };
  const navigate = (direction: 'back' | 'forward') => {
    if (drawer) setDrawer(undefined);
    else if (settingsOpen) setSettingsOpen(false);
    else if (browser.history[direction]) browser.navigate(direction === 'back' ? 'goBack' : 'goForward');
  };
  const gestures = useBrowserNavigationGestures(visible, () => navigate('back'), () => navigate('forward'));
  useLanguage();
  useEffect(() => { if (request) browser.visit(request.url); }, [request]);
  useEffect(() => {
    if (!visible) { setSettingsOpen(false); setDrawer(undefined); }
  }, [visible]);
  return <SafeAreaView style={styles.page} {...gestures}>
    <View style={styles.fill}>
    {/* Keep the WebView's native parent stable when the menu changes accessibility visibility. */}
    <View collapsable={false} style={styles.fill} accessibilityElementsHidden={settingsOpen}
      importantForAccessibility={settingsOpen ? 'no-hide-descendants' : 'auto'}>
      <MappingBrowserToolbar browser={browser} settingsOpen={settingsOpen}
        tabCount={tabCount} newTab={() => { void snapshotThen(newTab); }}
        manageTabs={() => { void snapshotThen(manageTabs); }}
        openSettings={() => { Keyboard.dismiss(); setSettingsOpen(true); }}
        onLayout={event => setToolbarHeight(event.nativeEvent.layout.height)} />
      {!!browser.error && <Text accessibilityRole="alert" style={[browserStyles.message, browserStyles.error]}>
        {browser.error}</Text>}
      <View ref={page} collapsable={false} style={styles.fill}>
      <WebView ref={browser.webview} source={browser.source.uri ? browser.source : undefined} style={styles.fill}
        incognito={false} domStorageEnabled
        originWhitelist={['http://*', 'https://*']} allowFileAccess={false}
        allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        sharedCookiesEnabled thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
        // Android enforces this through patch-webview-permissions.cjs, including after redirects.
        geolocationEnabled={false} mediaCapturePermissionGrantType="deny"
        injectedJavaScriptBeforeContentLoaded={PREVIEW_NETWORK_SCRIPT}
        injectedJavaScript={PREVIEW_NETWORK_SCRIPT}
        onMessage={activity.onMessage} onLoadStart={activity.onLoadStart} onLoadEnd={activity.onLoadEnd}
        onShouldStartLoadWithRequest={request => /^https?:\/\//i.test(request.url)
          || !browser.source.uri && request.url === 'about:blank'}
        onNavigationStateChange={state => {
          browser.onNavigationStateChange(state);
          if (/^https?:\/\//i.test(state.url)) onNavigate?.(state.url, state.title);
        }}
        renderError={() => <View style={styles.empty}>
          <Text style={browserStyles.message}>
            {t("client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs")}</Text></View>}
        onError={browser.onError} />
      </View>
    </View>
    {settingsOpen && <MappingBrowserSettings top={toolbarHeight}
      external={browser.currentUrl ? () => { setSettingsOpen(false); void browser.openExternal(); } : undefined}
      bookmarks={() => { setSettingsOpen(false); setDrawer('bookmarks'); }}
      mappings={() => { setSettingsOpen(false); setDrawer('mappings'); }}
      search={() => { setSettingsOpen(false); setDrawer('search'); }}
      dismiss={() => setSettingsOpen(false)} close={close} />}
    {drawer === 'bookmarks' && <BrowserBookmarks currentUrl={browser.currentUrl} currentTitle={browser.title}
      visit={url => { setDrawer(undefined); browser.visit(url); }} close={() => setDrawer(undefined)} />}
    {drawer === 'mappings' && <BrowserPortMappings devices={devices}
      visit={url => { setDrawer(undefined); browser.visit(url); }} close={() => setDrawer(undefined)} />}
    {drawer === 'search' && <BrowserSearchEngines close={() => setDrawer(undefined)} />}
    </View>
    </SafeAreaView>;
}
