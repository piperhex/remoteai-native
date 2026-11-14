import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
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
import { BrowserHome } from '../../browser/BrowserHome';
import { BrowserPortMappings } from '../../browser/BrowserPortMappings';
import type { BrowserDevice } from '../../browser/browserMappings';
import { BrowserSearchEngines } from '../../browser/BrowserSearchEngines';
import { useBrowserNavigationGestures } from '../../browser/useBrowserNavigationGestures';
import { useBrowserSafeAreaEdges } from '../../browser/context';
import { useBrowserSiteMode } from '../../browser/useBrowserSiteMode';
import type { NativeBrowserResource } from '../../browser/browserTabs';
import { BrowserFullscreenExit } from '../../browser/BrowserFullscreenExit';
import { BrowserHistory } from '../../browser/BrowserHistory';
import { BrowserPasswords, NativePasswordCapture } from '../../browser/BrowserPasswords';
import { useNativeBrowserRecords } from '../../browser/useBrowserRecords';

export function MappingPreview({ port, initialUrl = '', resource, request, visible = true, onNavigate, close, devices = [],
  tabCount = 1, newTab = () => {}, manageTabs = () => {}, onPreview, desktop = false, onDesktopChange = () => {},
  fullscreen = false, onFullscreenChange = () => {}, dataGeneration = 0 }: {
  port?: number; initialUrl?: string; request?: { url: string }; visible?: boolean;
  resource?: NativeBrowserResource;
  onNavigate?: (url: string, title: string) => void; close: () => void;
  devices?: readonly BrowserDevice[];
  tabCount?: number; newTab?: () => void; manageTabs?: () => void; onPreview?: (uri: string) => void;
  desktop?: boolean; onDesktopChange?: (desktop: boolean) => void;
  fullscreen?: boolean; onFullscreenChange?: (fullscreen: boolean) => void; dataGeneration?: number;
}) {
  const styles = useStyles();
  const safeAreaEdges = useBrowserSafeAreaEdges();
  const browserStyles = useMappingBrowserStyles();
  const browser = useMappingBrowser(port ? `http://127.0.0.1:${port}` : initialUrl, resource);
  const site = useBrowserSiteMode(desktop, browser.webview);
  const records = useNativeBrowserRecords(browser.webview, visible);
  const { activity } = browser;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreenMenuOpen, setFullscreenMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState<'bookmarks' | 'mappings' | 'search' | 'history' | 'passwords'>();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const page = useRef<View>(null);
  const capturing = useRef(false);
  const snapshotThen = async (action: () => void) => {
    if (capturing.current) return;
    Keyboard.dismiss();
    capturing.current = true;
    try {
      if (page.current && onPreview) {
        const data = await captureRef(page, { format: 'jpg', quality: 0.55, width: 320, result: 'base64' });
        onPreview(`data:image/jpeg;base64,${data}`);
      }
    } catch { /* A page may be detached or protected; the tab still remains available without a thumbnail. */ }
    finally { capturing.current = false; action(); }
  };
  const navigate = (direction: 'back' | 'forward') => {
    if (fullscreenMenuOpen) setFullscreenMenuOpen(false);
    else if (drawer) setDrawer(undefined);
    else if (settingsOpen) setSettingsOpen(false);
    else if (fullscreen) onFullscreenChange(false);
    else if (browser.history[direction]) browser.navigate(direction === 'back' ? 'goBack' : 'goForward');
    else if (direction === 'back') close();
  };
  const gestures = useBrowserNavigationGestures(visible, () => navigate('back'), () => navigate('forward'));
  useLanguage();
  useEffect(() => { if (request) browser.visit(request.url); }, [request]);
  useEffect(() => {
    if (!visible) {
      setSettingsOpen(false); setDrawer(undefined);
      // Native keyboard dismissal does not blur focused inputs inside a retained WebView.
      browser.webview.current?.injectJavaScript('document.activeElement?.blur?.(); true;');
    }
  }, [visible]);
  return <SafeAreaView style={styles.page} edges={fullscreen ? ['left', 'right'] : safeAreaEdges} {...gestures}>
    <View style={styles.fill}>
    {/* Keep the WebView's native parent stable when the menu changes accessibility visibility. */}
    <View collapsable={false} style={styles.fill} accessibilityElementsHidden={settingsOpen}
      importantForAccessibility={settingsOpen ? 'no-hide-descendants' : 'auto'}>
      {!fullscreen && <MappingBrowserToolbar browser={browser} settingsOpen={settingsOpen}
        tabCount={tabCount} newTab={() => { void snapshotThen(newTab); }}
        manageTabs={() => { void snapshotThen(manageTabs); }}
        openSettings={() => { Keyboard.dismiss(); setSettingsOpen(true); }}
        onLayout={event => setToolbarHeight(event.nativeEvent.layout.height)} />}
      {!!browser.error && <Text accessibilityRole="alert" style={[browserStyles.message, browserStyles.error]}>
        {browser.error}</Text>}
      <View ref={page} collapsable={false} style={styles.fill}>
      <View style={[StyleSheet.absoluteFill, (browser.resourceVisible || browser.homeVisible) && { display: 'none' }]}>
      <WebView key={dataGeneration} ref={browser.webview}
        source={browser.source.uri ? browser.source : undefined} style={styles.fill}
        // Keep the system's default UA mobile; desktop mode overrides it without replacing the WebView.
        userAgent={site.userAgent} contentMode="mobile"
        incognito={false} domStorageEnabled
        originWhitelist={['http://*', 'https://*']} allowFileAccess={false}
        allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        sharedCookiesEnabled thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
        // Ask before first capture; Android retains successful consent for this tab's current site.
        geolocationEnabled={false} mediaCapturePermissionGrantType="prompt" allowsInlineMediaPlayback
        injectedJavaScriptBeforeContentLoaded={site.script + PREVIEW_NETWORK_SCRIPT + records.script}
        injectedJavaScript={site.script + PREVIEW_NETWORK_SCRIPT + records.script}
        onMessage={event => { if (!records.receive(event) && !site.receive(event)) activity.onMessage(event); }}
        onLoadStart={activity.onLoadStart} onLoadEnd={activity.onLoadEnd}
        onShouldStartLoadWithRequest={request => /^https?:\/\//i.test(request.url)
          || !browser.source.uri && request.url === 'about:blank'}
        onNavigationStateChange={state => {
          browser.onNavigationStateChange(state);
          records.navigate(state);
          if (/^https?:\/\//i.test(state.url)) onNavigate?.(state.url, state.title);
        }}
        renderError={() => <View style={styles.empty}>
          <Text style={browserStyles.message}>
            {t("client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs")}</Text></View>}
        onError={browser.onError} />
      </View>
      {resource && <View key={browser.resourceGeneration}
        style={[styles.fill, (!browser.resourceVisible || browser.homeVisible) && { display: 'none' }]}>
        {resource.render({ active: visible && browser.resourceVisible && !browser.homeVisible, close })}
      </View>}
      {browser.homeVisible && <BrowserHome devices={devices} visit={browser.visit}
        bookmarks={() => setDrawer('bookmarks')} />}
      </View>
    </View>
    {settingsOpen && <MappingBrowserSettings top={toolbarHeight}
      url={browser.currentUrl} title={browser.title}
      desktop={desktop} onDesktopChange={onDesktopChange}
      fullscreen={() => { setSettingsOpen(false); onFullscreenChange(true); }}
      external={!browser.resourceVisible && browser.currentUrl
        ? () => { setSettingsOpen(false); void browser.openExternal(); } : undefined}
      bookmarks={() => { setSettingsOpen(false); setDrawer('bookmarks'); }}
      mappings={() => { setSettingsOpen(false); setDrawer('mappings'); }}
      search={() => { setSettingsOpen(false); setDrawer('search'); }}
      history={() => { setSettingsOpen(false); setDrawer('history'); }}
      passwords={() => { setSettingsOpen(false); setDrawer('passwords'); }}
      dismiss={() => setSettingsOpen(false)} reload={() => browser.navigate('reload')} />}
    {fullscreen && <BrowserFullscreenExit open={fullscreenMenuOpen} setOpen={setFullscreenMenuOpen}
      exit={() => onFullscreenChange(false)} />}
    {drawer === 'bookmarks' && <BrowserBookmarks currentUrl={browser.currentUrl} currentTitle={browser.title}
      visit={url => { setDrawer(undefined); browser.visit(url); }} close={() => setDrawer(undefined)} />}
    {drawer === 'mappings' && <BrowserPortMappings devices={devices}
      visit={url => { setDrawer(undefined); browser.visit(url); }} close={() => setDrawer(undefined)} />}
    {drawer === 'search' && <BrowserSearchEngines close={() => setDrawer(undefined)} />}
    {drawer === 'history' && <BrowserHistory controls={records.controls} close={() => setDrawer(undefined)}
      visit={url => { setDrawer(undefined); browser.visit(url); }} />}
    {drawer === 'passwords' && <BrowserPasswords currentUrl={browser.currentUrl} fill={records.fill}
      close={() => setDrawer(undefined)} />}
    {records.candidate && <NativePasswordCapture login={records.candidate} close={records.closeCapture} />}
    </View>
    </SafeAreaView>;
}
