import { useRef, useState } from 'react';
import { Keyboard, Linking } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { t } from '../../i18n';
import { usePreviewActivity } from './usePreviewActivity';

export function mappingBrowserUrl(address: string): string | undefined {
  const value = address.trim();
  if (!value) return;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(value);
  try {
    const url = new URL(withScheme ? value : `http://${value}`);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch { /* Keep invalid input available for correction. */ }
}

export function useMappingBrowser(port: number) {
  const initialUrl = `http://127.0.0.1:${port}`;
  const webview = useRef<WebView>(null);
  const opening = useRef(false);
  const [source, setSource] = useState({ uri: initialUrl });
  const [address, setAddress] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [history, setHistory] = useState({ back: false, forward: false });
  const [error, setError] = useState('');
  const activity = usePreviewActivity();
  const navigate = (action: 'goBack' | 'goForward' | 'reload') => {
    setError(''); activity.onLoadStart(); webview.current?.[action]();
  };
  const submit = () => {
    const url = mappingBrowserUrl(address);
    if (!url) { setError(t('client.runtimeErrors.useAValidServerAddress')); return; }
    Keyboard.dismiss();
    setAddress(url);
    if (url === mappingBrowserUrl(currentUrl)) { navigate('reload'); return; }
    setError(''); activity.onLoadStart();
    // After Back, submitting the last source again would leave the native source prop unchanged.
    if (url === source.uri) webview.current?.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
    else setSource({ uri: url });
  };
  const onNavigationStateChange = (state: WebViewNavigation) => {
    setHistory({ back: state.canGoBack, forward: state.canGoForward });
    if (/^https?:\/\//i.test(state.url)) { setCurrentUrl(state.url); setAddress(state.url); }
  };
  const openExternal = async () => {
    if (opening.current) return;
    opening.current = true;
    setError('');
    try { await Linking.openURL(currentUrl); }
    catch { setError(t('client.portForwarding.couldNotOpenTheBrowserPleaseTryAgain')); }
    finally { opening.current = false; }
  };
  const onError = () => {
    activity.reset();
    setError(t('client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs'));
  };
  return { webview, source, address, setAddress, history, error, activity,
    navigate, submit, onNavigationStateChange, openExternal, onError };
}
