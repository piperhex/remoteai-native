import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Text, View } from 'react-native';
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

export function MappingPreview({ port, initialUrl = '', request, visible = true, onNavigate, close, devices = [] }: {
  port?: number; initialUrl?: string; request?: { url: string }; visible?: boolean;
  onNavigate?: (url: string) => void; close: () => void;
  devices?: readonly BrowserDevice[];
}) {
  const styles = useStyles();
  const browserStyles = useMappingBrowserStyles();
  const browser = useMappingBrowser(port ? `http://127.0.0.1:${port}` : initialUrl);
  const { activity } = browser;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState<'bookmarks' | 'mappings' | 'search'>();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  useLanguage();
  useEffect(() => { if (request) browser.visit(request.url); }, [request]);
  useEffect(() => {
    if (!visible) { setSettingsOpen(false); setDrawer(undefined); }
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawer) setDrawer(undefined);
      else if (settingsOpen) setSettingsOpen(false);
      else close();
      return true;
    });
    return () => listener.remove();
  }, [visible, settingsOpen, drawer, close]);
  return <SafeAreaView style={styles.page}>
    <View style={styles.fill}>
    {/* Keep the WebView's native parent stable when the menu changes accessibility visibility. */}
    <View collapsable={false} style={styles.fill} accessibilityElementsHidden={settingsOpen}
      importantForAccessibility={settingsOpen ? 'no-hide-descendants' : 'auto'}>
      <MappingBrowserToolbar browser={browser} settingsOpen={settingsOpen}
        openSettings={() => { Keyboard.dismiss(); setSettingsOpen(true); }}
        onLayout={event => setToolbarHeight(event.nativeEvent.layout.height)} />
      {!!browser.error && <Text accessibilityRole="alert" style={[browserStyles.message, browserStyles.error]}>
        {browser.error}</Text>}
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
          if (/^https?:\/\//i.test(state.url)) onNavigate?.(state.url);
        }}
        renderError={() => <View style={styles.empty}>
          <Text style={browserStyles.message}>
            {t("client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs")}</Text></View>}
        onError={browser.onError} />
    </View>
    {settingsOpen && <MappingBrowserSettings top={toolbarHeight}
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
