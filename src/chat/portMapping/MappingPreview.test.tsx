import * as React from 'react';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { beforeEach, expect, it, vi } from 'vitest';
import { MappingPreview } from './MappingPreview';
import type { MappingBrowserToolbar } from './MappingBrowserToolbar';
import { mappingBrowserUrl, useMappingBrowser } from './useMappingBrowser';
import { PREVIEW_NETWORK_BUSY, PREVIEW_NETWORK_IDLE } from './previewNetworkActivity';

const runtime = vi.hoisted(() => ({ cursor: 0, states: [] as unknown[],
  refs: [] as { current: unknown }[], refCursor: 0,
  openURL: vi.fn(async (_url: string) => {}),
  webview: { reload: vi.fn(), goBack: vi.fn(), goForward: vi.fn(), injectJavaScript: vi.fn() } }));
vi.mock('react', async original => ({ ...await original<typeof React>(),
  useEffect: vi.fn(),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useRef: (initial: unknown) => {
    const index = runtime.refCursor++;
    return runtime.refs[index] ??= { current: initial === null ? runtime.webview : initial };
  },
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    if (!(index in runtime.states)) runtime.states[index] = initial;
    return [runtime.states[index], (value: unknown) => {
      runtime.states[index] = typeof value === 'function' ? value(runtime.states[index]) : value;
    }];
  },
}));
vi.mock('react-native', () => ({ Linking: { openURL: runtime.openURL }, Keyboard: { dismiss: vi.fn() },
  StyleSheet: { absoluteFill: {} },
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 1, fontScale: 1 }),
  Modal: 'Modal', Platform: { OS: 'android' },
  Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: 'Provider', SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));
vi.mock('react-native-view-shot', () => ({ captureRef: vi.fn() }));
vi.mock('../../browser/useBrowserNavigationGestures', () => ({ useBrowserNavigationGestures: () => ({}) }));
vi.mock('../../browser/context', () => ({ useBrowserSafeAreaEdges: () => undefined }));
vi.mock('../../browser/BrowserFullscreenExit', () => ({ BrowserFullscreenExit: 'FullscreenExit' }));
vi.mock('./MappingPreviewActivity', () => ({ MappingPreviewActivity: 'Activity' }));
vi.mock('./MappingBrowserToolbar', () => ({ MappingBrowserToolbar: 'Toolbar' }));
vi.mock('./MappingBrowserSettings', () => ({ MappingBrowserSettings: 'Settings' }));
vi.mock('../../browser/BrowserBookmarks', () => ({ BrowserBookmarks: 'Bookmarks' }));
vi.mock('../../browser/BrowserHome', () => ({ BrowserHome: 'Home' }));
vi.mock('../../browser/BrowserPortMappings', () => ({ BrowserPortMappings: 'Mappings' }));
vi.mock('../../browser/BrowserSearchEngines', () => ({ BrowserSearchEngines: 'SearchEngines' }));
vi.mock('../../browser/BrowserHistory', () => ({ BrowserHistory: 'History' }));
vi.mock('../../browser/BrowserPasswords', () => ({ BrowserPasswords: 'Passwords', NativePasswordCapture: 'Capture' }));
vi.mock('../../browser/useBrowserRecords', () => ({ useNativeBrowserRecords: () => ({
  navigate: vi.fn(), receive: () => false, script: '', controls: {}, fill: vi.fn(), closeCapture: vi.fn(),
}) }));
vi.mock('../../browser/searchEngine', () => ({ useNativeSearchEngine: () => ({ engine: 'google' }) }));
vi.mock('./mappingBrowserStyles', () => ({ useMappingBrowserStyles: () => ({}) }));
vi.mock('../../components/Modal', () => ({ Modal: 'Modal' }));
vi.mock('../styles', () => ({ useStyles: () => ({}) }));
vi.mock('../../i18n', async () => ({ ...await vi.importActual<typeof import('../../i18n')>('../../i18n'),  }));

type Props = WebViewProps & Partial<React.ComponentProps<typeof MappingBrowserToolbar>>
  & { children?: React.ReactNode; active?: boolean; onPress?: () => void };
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function render() {
  runtime.cursor = 0;
  runtime.refCursor = 0;
  return elements(MappingPreview({ port: 3002, close: vi.fn() }));
}
const webview = () => render().find(node => node.type === 'WebView')!.props;
const browser = () => render().find(node => node.type === 'Toolbar')!.props.browser!;
const active = () => browser().activity.active;
const message = (data: string) => webview().onMessage!({ nativeEvent: { data } } as WebViewMessageEvent);

beforeEach(() => { vi.stubGlobal('React', React); vi.clearAllMocks(); runtime.states = []; runtime.refs = []; });

it('asks before website audio and video capture while keeping location disabled', () => {
  expect(webview()).toMatchObject({ mediaCapturePermissionGrantType: 'prompt', geolocationEnabled: false,
    allowsInlineMediaPlayback: true });
});

it('shows activity from initial navigation through outstanding page requests', () => {
  expect(active()).toBe(true);
  message(PREVIEW_NETWORK_BUSY);
  webview().onLoadEnd!({} as never);
  expect(active()).toBe(true);
  message(PREVIEW_NETWORK_IDLE);
  expect(active()).toBe(false);
  message('unrelated page message');
  expect(active()).toBe(false);
  message(PREVIEW_NETWORK_BUSY);
  expect(active()).toBe(true);
  message(PREVIEW_NETWORK_IDLE);
  expect(active()).toBe(false);
});

it('does not stop page loading when an individual request finishes', () => {
  message(PREVIEW_NETWORK_BUSY);
  message(PREVIEW_NETWORK_IDLE);
  expect(active()).toBe(true);
  webview().onLoadEnd!({} as never);
  expect(active()).toBe(false);
});

it('clears activity on failure and starts it immediately for refresh and back navigation', () => {
  message(PREVIEW_NETWORK_BUSY);
  webview().onError!({} as never);
  expect(active()).toBe(false);
  browser().navigate('reload');
  expect(runtime.webview.reload).toHaveBeenCalledOnce();
  expect(active()).toBe(true);
  webview().onLoadEnd!({} as never);
  expect(active()).toBe(false);
  webview().onNavigationStateChange!({ canGoBack: true } as never);
  browser().navigate('goBack');
  expect(runtime.webview.goBack).toHaveBeenCalledOnce();
  expect(active()).toBe(true);
});

it('tracks navigation history and opens the current page externally without reloading the initial source', async () => {
  webview().onNavigationStateChange!({ url: 'http://127.0.0.1:3002/next',
    canGoBack: true, canGoForward: false } as never);
  expect(browser().address).toBe('http://127.0.0.1:3002/next');
  expect(browser().history).toEqual({ back: true, forward: false });
  expect(webview().source).toEqual({ uri: 'http://127.0.0.1:3002' });
  browser().setAddress('http://not-submitted.example');
  await browser().openExternal();
  expect(runtime.openURL).toHaveBeenCalledWith('http://127.0.0.1:3002/next');
  webview().onNavigationStateChange!({ url: 'http://127.0.0.1:3002',
    canGoBack: false, canGoForward: true } as never);
  expect(browser().history).toEqual({ back: true, forward: true });
  browser().navigate('goForward');
  expect(runtime.webview.goForward).toHaveBeenCalledOnce();
});

it('submits HTTP addresses and preserves invalid input without navigating', () => {
  browser().setAddress('127.0.0.1:3002/next'); browser().submit();
  expect(webview().source).toEqual({ uri: 'http://127.0.0.1:3002/next' });
  browser().setAddress('javascript:alert(1)'); browser().submit();
  expect(browser().error).toBe('请使用有效的服务器地址。');
  expect(browser().address).toBe('javascript:alert(1)');
  expect(webview().source).toEqual({ uri: 'http://127.0.0.1:3002/next' });
  for (const value of ['', 'file:///private', 'data:text/html,hello', 'https://']) {
    expect(mappingBrowserUrl(value)).toBeUndefined();
  }
  expect(mappingBrowserUrl(' https://example.com/a?q=1 ')).toBe('https://example.com/a?q=1');
  expect(mappingBrowserUrl('localhost:8080')).toBe('http://localhost:8080/');
});

it('submits the native input value before a pending React render', () => {
  const current = browser();
  current.setAddress('http://127.0.0.1:3003/');
  current.submit('http://127.0.0.1:3003/');
  expect(webview().source).toEqual({ uri: 'http://127.0.0.1:3003/' });
});

it('reloads the current address and reports external browser errors without closing the preview', async () => {
  browser().submit();
  expect(runtime.webview.reload).toHaveBeenCalledOnce();
  runtime.openURL.mockRejectedValueOnce(new Error('not available'));
  await browser().openExternal();
  expect(browser().error).toBe('无法打开浏览器，请重试。');
});

it('can revisit a submitted address after going back without losing browser history', () => {
  browser().setAddress('http://127.0.0.1:3002/next'); browser().submit();
  webview().onNavigationStateChange!({ url: 'http://127.0.0.1:3002/next',
    canGoBack: true, canGoForward: false } as never);
  browser().navigate('goBack');
  webview().onNavigationStateChange!({ url: 'http://127.0.0.1:3002/',
    canGoBack: false, canGoForward: true } as never);
  expect(webview().source).toEqual({ uri: 'http://127.0.0.1:3002/next' });
  browser().setAddress('http://127.0.0.1:3002/next'); browser().submit();
  expect(webview().source).toEqual({ uri: 'http://127.0.0.1:3002/next' });
  expect(runtime.webview.injectJavaScript).toHaveBeenCalledWith(
    'window.location.assign("http://127.0.0.1:3002/next"); true;');
});

it('searches numbers and never turns delayed navigation or error reports into new loads', () => {
  browser().submit('666');
  const source = webview().source;
  expect(source).toEqual({ uri: 'https://www.google.com/search?q=666' });
  browser().submit('664656');
  const pending = webview().source;
  expect(pending).toEqual({ uri: 'https://www.google.com/search?q=664656' });
  for (const url of ['http://0.0.2.154/', 'http://0.10.36.80/', 'http://0.0.2.154/']) {
    webview().onNavigationStateChange!({ url, canGoBack: true, canGoForward: false } as never);
    webview().onError!({} as never);
    expect(webview().source).toBe(pending);
  }
  expect(runtime.webview.injectJavaScript).not.toHaveBeenCalled();
  expect(runtime.webview.reload).not.toHaveBeenCalled();
});

it('revisits the last submitted URL from a bookmark after a redirect', () => {
  const target = 'https://example.test/start?q=%22quoted%22';
  browser().visit(target);
  webview().onNavigationStateChange!({ url: 'https://example.test/final',
    canGoBack: true, canGoForward: false } as never);
  browser().visit(target);
  expect(runtime.webview.injectJavaScript).toHaveBeenCalledWith(`window.location.assign(${JSON.stringify(target)}); true;`);
  expect(runtime.webview.reload).not.toHaveBeenCalled();
});

it('resets requests from the previous document when navigating to another page', () => {
  message(PREVIEW_NETWORK_BUSY);
  webview().onLoadStart!({} as never);
  webview().onLoadEnd!({} as never);
  expect(active()).toBe(false);
  expect(webview().injectedJavaScriptBeforeContentLoaded).toBe(webview().injectedJavaScript);
});

it('retains the resource when browsing websites and reloads the selected website after returning', () => {
  const resource = { url: 'file:///report.md', title: 'report.md', render: () => null };
  const current = () => {
    runtime.cursor = 0; runtime.refCursor = 0;
    return useMappingBrowser(resource.url, resource);
  };
  expect(current().resourceVisible).toBe(true);
  current().submit('https://example.test/');
  current().onNavigationStateChange({ url: 'https://example.test/',
    canGoBack: false, canGoForward: false, title: 'Example' } as never);
  current().navigate('goBack');
  expect(current().currentUrl).toBe(resource.url);
  expect(current().history).toEqual({ back: true, forward: true });
  current().submit('https://example.test/');
  expect(current().resourceVisible).toBe(false);
  expect(runtime.webview.reload).toHaveBeenCalledOnce();
  expect(current().resourceGeneration).toBe(0);
  current().navigate('goBack');
  current().navigate('reload');
  expect(current().resourceGeneration).toBe(1);
  current().navigate('goForward');
  expect(current().currentUrl).toBe('https://example.test/');
});

it('returns home without replacing a resource and restores it with Back', () => {
  const resource = { url: 'file:///report.md', title: 'report.md', render: () => null };
  const current = () => {
    runtime.cursor = 0; runtime.refCursor = 0;
    return useMappingBrowser(resource.url, resource);
  };
  current().home();
  expect(current().homeVisible).toBe(true);
  expect(current().currentUrl).toBe('');
  expect(current().address).toBe('');
  current().navigate('goBack');
  expect(current().homeVisible).toBe(false);
  expect(current().resourceVisible).toBe(true);
  expect(current().currentUrl).toBe(resource.url);
  current().navigate('goBack');
  expect(current().homeVisible).toBe(true);
  expect(current().history).toEqual({ back: false, forward: true });
  current().navigate('goForward');
  expect(current().resourceVisible).toBe(true);
  expect(current().homeVisible).toBe(false);
  expect(current().resourceGeneration).toBe(0);
});

it('keeps background URL updates out of the home address bar and opens a homepage link', () => {
  browser().home();
  webview().onNavigationStateChange!({ url: 'http://127.0.0.1:3002/',
    canGoBack: false, canGoForward: false } as never);
  expect(browser().address).toBe('');
  browser().visit('http://127.0.0.1:3002/');
  expect(browser().homeVisible).toBe(false);
  expect(browser().address).toBe('http://127.0.0.1:3002/');
  expect(runtime.webview.reload).not.toHaveBeenCalled();
});
