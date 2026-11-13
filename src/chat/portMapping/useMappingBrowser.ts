import { useRef, useState } from 'react';
import { Keyboard, Linking } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import { t } from '../../i18n';
import { usePreviewActivity } from './usePreviewActivity';
import { browserInput } from '../../../vendor/shared/browser/addressInput';
import { useNativeSearchEngine } from '../../browser/searchEngine';
import type { NativeBrowserResource } from '../../browser/browserTabs';

export function mappingBrowserUrl(address: string): string | undefined {
  const value = address.trim();
  if (!value) return;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(value);
  try {
    const url = new URL(withScheme ? value : `http://${value}`);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch { /* Keep invalid input available for correction. */ }
}

export function useMappingBrowser(initialUrl: string, resource?: NativeBrowserResource) {
  const search = useNativeSearchEngine();
  const webview = useRef<WebView>(null);
  const opening = useRef(false);
  const editing = useRef(false);
  const [resourceVisible, setResourceVisible] = useState(Boolean(resource));
  const [resourceGeneration, setResourceGeneration] = useState(0);
  const [source, setSource] = useState({ uri: resource ? '' : initialUrl });
  const [address, setAddress] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(resource ? '' : initialUrl);
  const [title, setTitle] = useState('');
  const [history, setHistory] = useState({ back: false, forward: false });
  const [error, setError] = useState('');
  const activity = usePreviewActivity();
  const navigate = (action: 'goBack' | 'goForward' | 'reload') => {
    editing.current = false;
    if (resourceVisible) {
      if (action === 'reload') setResourceGeneration(value => value + 1);
      if (action === 'goForward' && currentUrl) { setResourceVisible(false); setAddress(currentUrl); }
      return;
    }
    if (resource && action === 'goBack' && !history.back) {
      setResourceVisible(true); setAddress(resource.url); return;
    }
    setError(''); activity.onLoadStart(); webview.current?.[action]();
  };
  const submit = (value = address) => {
    if (resource && value.trim() === resource.url) {
      editing.current = false;
      Keyboard.dismiss(); setError(''); setAddress(resource.url); setResourceVisible(true); return;
    }
    const url = browserInput(value, search.engine, 'http:')?.href;
    if (!url) { setError(t('client.runtimeErrors.useAValidServerAddress')); return; }
    editing.current = false;
    Keyboard.dismiss();
    setResourceVisible(false);
    setAddress(url);
    setError(''); activity.onLoadStart();
    if (url === mappingBrowserUrl(currentUrl)) { webview.current?.reload(); return; }
    setSource({ uri: url });
  };
  const visit = (address: string) => {
    const url = mappingBrowserUrl(address);
    if (!url) return;
    setResourceVisible(false);
    if (url === mappingBrowserUrl(currentUrl)) { setAddress(url); return; }
    editing.current = false;
    setAddress(url); setError(''); activity.onLoadStart(); setSource({ uri: url });
  };
  const onNavigationStateChange = (state: WebViewNavigation) => {
    setHistory({ back: state.canGoBack, forward: state.canGoForward });
    if (!/^https?:\/\//i.test(state.url)) return;
    setCurrentUrl(state.url);
    if (!editing.current && !resourceVisible) setAddress(state.url);
    setTitle(state.title);
    // Native WebViews skip loading an already-current URL. Keep source aligned after Back/Forward
    // so the next address submission is a browser navigation, preserving usable history entries.
    setSource({ uri: state.url });
  };
  const openExternal = async () => {
    if (opening.current || !currentUrl) return;
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
  const editAddress = (value: string) => { editing.current = true; setAddress(value); };
  return { webview, source, address, setAddress: editAddress,
    currentUrl: resourceVisible ? resource!.url : currentUrl,
    title: resourceVisible ? resource!.title : title,
    history: resourceVisible ? { back: false, forward: Boolean(currentUrl) }
      : { ...history, back: history.back || Boolean(resource) },
    resourceVisible, resourceGeneration, error, activity,
    navigate, submit, visit, onNavigationStateChange, openExternal, onError };
}
