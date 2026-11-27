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
import { useMappingCertificate } from '../../browser/useMappingCertificate';
import { MappingCertificateWarning } from '../../browser/MappingCertificateWarning';
import { BrowserBookmarks } from '../../browser/BrowserBookmarks';
import { BrowserHome } from '../../browser/BrowserHome';
import { BrowserMousePanel, useBrowserMousePreference } from '../../browser/BrowserMousePanel';
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
import { NativePasswordSuggestions } from '../../browser/PasswordSuggestions';
import { browserInspectorAvailable, type BrowserInspectorControls } from '../../browser/inspector/useBrowserInspector';
import type { BrowserDownloadRequest } from '../../downloads/browserDownload';
import { PageDownloads, type PageDownloadHandlers } from '../../browser/pageDownloads';
import { isPageDownloadUrl, PAGE_DOWNLOAD_SCRIPT } from '../../browser/pageDownloadScript';

const COMPACT_TOOLBAR_WIDTH = 272;

export function MappingPreview({ port, trustScope, initialUrl = '', resource, request, onRequestHandled,
  visible = true, onNavigate, close, devices = [],
  tabCount = 1, newTab = () => {}, manageTabs = () => {}, onPreview, desktop = false, onDesktopChange = () => {},
  fullscreen = false, onFullscreenChange = () => {}, dataGeneration = 0, inspector, onInspectorObscuredChange,
  onDownload, pageDownloads, openDownloads }: {
  port?: number; trustScope?: string; initialUrl?: string; request?: { url: string }; visible?: boolean;
  resource?: NativeBrowserResource; onRequestHandled?: (request: { url: string }) => void;
  onNavigate?: (url: string, title: string) => void; close: () => void;
  devices?: readonly BrowserDevice[];
  tabCount?: number; newTab?: () => void; manageTabs?: () => void; onPreview?: (uri: string) => void;
  desktop?: boolean; onDesktopChange?: (desktop: boolean) => void;
  fullscreen?: boolean; onFullscreenChange?: (fullscreen: boolean) => void; dataGeneration?: number;
  inspector?: BrowserInspectorControls; onInspectorObscuredChange?: (obscured: boolean) => void;
  onDownload?: (request: BrowserDownloadRequest) => void;
  pageDownloads?: PageDownloadHandlers;
  openDownloads?: () => void;
}) {
  const styles = useStyles();
  const safeAreaEdges = useBrowserSafeAreaEdges();
  const browserStyles = useMappingBrowserStyles();
  const browser = useMappingBrowser(port ? `http://127.0.0.1:${port}` : initialUrl, resource);
  const certificate = useMappingCertificate(trustScope, browser.source.uri);
  const site = useBrowserSiteMode(desktop, browser.webview);
  const records = useNativeBrowserRecords(browser.webview, visible);
  const downloads = useRef<PageDownloads | undefined>(undefined);
  downloads.current ??= new PageDownloads();
  const downloadScript = pageDownloads ? PAGE_DOWNLOAD_SCRIPT : '';
  const injectedScript = site.script + PREVIEW_NETWORK_SCRIPT + records.script + downloadScript;
  const { activity } = browser;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreenMenuOpen, setFullscreenMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState<'bookmarks' | 'mappings' | 'search' | 'history' | 'passwords'>();
  const [toolbar, setToolbar] = useState({ height: 0, width: 0 });
  const [previewHeight, setPreviewHeight] = useState(0);
  const page = useRef<View>(null);
  const cancelPageMouse = useRef<(() => void) | undefined>(undefined);
  const [mouseEnabled, setMouseEnabled] = useBrowserMousePreference();
  const canInspect = !browser.homeVisible && !browser.resourceVisible;
  const obscured = settingsOpen || !!drawer || fullscreenMenuOpen || !!records.candidate || !!records.focus;
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
    else if (inspector?.open) inspector.close();
    else if (fullscreen) onFullscreenChange(false);
    else if (browser.history[direction]) browser.navigate(direction === 'back' ? 'goBack' : 'goForward');
    else if (direction === 'back') close();
  };
  const gestures = useBrowserNavigationGestures(visible, () => navigate('back'), () => {
    Keyboard.dismiss(); inspector?.hideKeyboard();
  });
  useLanguage();
  useEffect(() => () => downloads.current?.reset(), [dataGeneration]);
  useEffect(() => {
    if (request) { browser.visit(request.url); onRequestHandled?.(request); }
  }, [request]);
  useEffect(() => {
    if (!request) onNavigate?.(browser.currentUrl, browser.title);
  }, [browser.currentUrl, browser.title]);
  useEffect(() => {
    if (visible) onInspectorObscuredChange?.(obscured);
  }, [visible, obscured, onInspectorObscuredChange]);
  useEffect(() => {
    if (!canInspect && inspector?.open) inspector.close();
  }, [canInspect, inspector?.open, inspector?.close]);
  useEffect(() => {
    if (!visible) {
      setSettingsOpen(false); setDrawer(undefined);
      // Native keyboard dismissal does not blur focused inputs inside a retained WebView.
      browser.webview.current?.injectJavaScript('document.activeElement?.blur?.(); true;');
    }
  }, [visible]);
  return <SafeAreaView style={styles.page} edges={fullscreen ? ['left', 'right'] : safeAreaEdges} {...gestures}>
    <View style={styles.fill} onLayout={event => setPreviewHeight(event.nativeEvent.layout.height)}>
    {/* Keep the WebView's native parent stable when the menu changes accessibility visibility. */}
    <View collapsable={false} style={styles.fill} accessibilityElementsHidden={settingsOpen}
      importantForAccessibility={settingsOpen ? 'no-hide-descendants' : 'auto'}>
      {!fullscreen && <MappingBrowserToolbar browser={browser} settingsOpen={settingsOpen}
        compact={toolbar.width > 0 && toolbar.width < COMPACT_TOOLBAR_WIDTH}
        tabCount={tabCount} newTab={() => { void snapshotThen(newTab); }}
        manageTabs={() => { void snapshotThen(manageTabs); }}
        openSettings={() => { Keyboard.dismiss(); setSettingsOpen(true); }}
        onLayout={event => {
          const { height, width } = event.nativeEvent.layout;
          setToolbar({ height, width });
        }} />}
      {!!browser.error && <Text accessibilityRole="alert" style={[browserStyles.message, browserStyles.error]}>
        {browser.error}</Text>}
      <BrowserMousePanel page={page} cancelOnLoad={cancelPageMouse} enabled={mouseEnabled}
        active={visible && !obscured} home={browser.homeVisible}>
      <View style={[StyleSheet.absoluteFill, (browser.resourceVisible || browser.homeVisible) && { display: 'none' }]}>
      {!!browser.source.uri && <WebView<{ mappingCertificatePolicy?: string }>
        key={JSON.stringify([dataGeneration, certificate.policy])} ref={browser.webview}
        mappingCertificatePolicy={certificate.policy}
        source={browser.source} style={styles.fill}
        // Keep the system's default UA mobile; desktop mode overrides it without replacing the WebView.
        userAgent={site.userAgent} contentMode="mobile"
        incognito={false} domStorageEnabled
        originWhitelist={['http://*', 'https://*']} allowFileAccess={false}
        allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        sharedCookiesEnabled thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
        // Ask before first capture; Android retains successful consent for this tab's current site.
        geolocationEnabled mediaCapturePermissionGrantType="prompt" allowsInlineMediaPlayback
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        injectedJavaScript={injectedScript}
        onMessage={event => {
          const { data, url } = event.nativeEvent;
          const handled = pageDownloads && downloads.current?.receive(data, url, pageDownloads, (id, ok) => {
            browser.webview.current?.injectJavaScript(`window.__remoteAiPageDownload?.acknowledge(${JSON.stringify(id)}, ${ok}); true;`);
          });
          if (!handled && !records.receive(event) && !site.receive(event)) activity.onMessage(event);
        }}
        onFileDownload={onDownload && (event => {
          activity.reset();
          const request: BrowserDownloadRequest = event.nativeEvent;
          if (pageDownloads && isPageDownloadUrl(request.downloadUrl)) {
            // The native listener covers downloads that did not originate from an observable anchor.
            const args = JSON.stringify([request.downloadUrl, request.downloadName ?? '']);
            browser.webview.current?.injectJavaScript(`window.__remoteAiPageDownload?.start(...${args}); true;`);
          } else onDownload(request);
        })}
        onLoadStart={() => { cancelPageMouse.current?.(); activity.onLoadStart(); }} onLoadEnd={activity.onLoadEnd}
        onLoadProgress={activity.onLoadProgress}
        onShouldStartLoadWithRequest={request => /^https?:\/\//i.test(request.url)
          || !browser.source.uri && request.url === 'about:blank'}
        onNavigationStateChange={state => {
          browser.onNavigationStateChange(state);
          records.navigate(state);
        }}
        renderError={() => certificate.current ? <MappingCertificateWarning key={certificate.current.fingerprint}
          url={certificate.current.url} fingerprint={certificate.current.fingerprint} changed={certificate.changed}
          back={() => { certificate.dismiss(); browser.navigate('goBack'); }}
          trust={() => { browser.retry(certificate.current!.url); certificate.trust(); }} /> : <View style={styles.empty}>
          <Text style={browserStyles.message}>
            {t("client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs")}</Text></View>}
        onError={event => {
          if (certificate.capture(event.nativeEvent)) activity.reset();
          else { certificate.dismiss(); browser.onError(); }
        }} />}
      </View>
      {resource && <View key={browser.resourceGeneration}
        style={[styles.fill, (!browser.resourceVisible || browser.homeVisible) && { display: 'none' }]}>
        {resource.render({ active: visible && browser.resourceVisible && !browser.homeVisible, close })}
      </View>}
      {browser.homeVisible && <BrowserHome devices={devices} visit={browser.visit}
        bookmarks={() => setDrawer('bookmarks')} />}
      </BrowserMousePanel>
    </View>
    {settingsOpen && <MappingBrowserSettings top={toolbar.height} width={toolbar.width} height={previewHeight}
      url={browser.currentUrl} title={browser.title}
      desktop={desktop} onDesktopChange={onDesktopChange}
      mouseEnabled={mouseEnabled} toggleMouse={() => { setMouseEnabled(!mouseEnabled); setSettingsOpen(false); }}
      inspector={browserInspectorAvailable && inspector ? { available: visible && Boolean(browser.currentUrl)
        && canInspect && !inspector.opening, open: () => inspector.show(page) } : undefined}
      fullscreen={() => { setSettingsOpen(false); onFullscreenChange(true); }}
      external={!browser.resourceVisible && browser.currentUrl
        ? () => { setSettingsOpen(false); void browser.openExternal(); } : undefined}
      bookmarks={() => { setSettingsOpen(false); setDrawer('bookmarks'); }}
      mappings={() => { setSettingsOpen(false); setDrawer('mappings'); }}
      search={() => { setSettingsOpen(false); setDrawer('search'); }}
      history={() => { setSettingsOpen(false); setDrawer('history'); }}
      downloads={openDownloads && (() => { setSettingsOpen(false); openDownloads(); })}
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
    {records.focus && <NativePasswordSuggestions focus={records.focus} fill={records.fill}
      close={records.closeSuggestions} />}
    </View>
    </SafeAreaView>;
}
