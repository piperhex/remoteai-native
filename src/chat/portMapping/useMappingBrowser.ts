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
  const [homeReturn, setHomeReturn] = useState<'goBack' | 'goForward' | undefined>();
  const [homeVisible, setHomeVisible] = useState(!initialUrl && !resource);
  const [resourceVisible, setResourceVisible] = useState(Boolean(resource));
  const [resourceGeneration, setResourceGeneration] = useState(0);
  const [source, setSource] = useState({ uri: resource ? '' : initialUrl });
  const [address, setAddress] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(resource ? '' : initialUrl);
  const [title, setTitle] = useState('');
  const [history, setHistory] = useState({ back: false, forward: false });
  const [error, setError] = useState('');
  const activity = usePreviewActivity();
  const load = (url: string) => {
    // After Back or a redirect, resubmitting the last source would not change the native prop.
    if (url === source.uri) webview.current?.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
    else setSource({ uri: url });
  };
  const home = () => {
    Keyboard.dismiss(); editing.current = false; setError('');
    if (!homeVisible) setHomeReturn('goBack');
    setHomeVisible(true); setAddress('');
  };
  const navigate = (action: 'goBack' | 'goForward' | 'reload') => {
    editing.current = false;
    if (homeVisible) {
      if (action === homeReturn) {
        setHomeVisible(false); setAddress(resourceVisible ? resource!.url : currentUrl);
      }
      return;
    }
    if (action === 'goBack' && (resourceVisible || !history.back && !resource)) {
      setHomeReturn('goForward'); setHomeVisible(true); setAddress(''); return;
    }
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
      Keyboard.dismiss(); setHomeVisible(false); setError(''); setAddress(resource.url); setResourceVisible(true); return;
    }
    const url = browserInput(value, search.engine, 'http:')?.href;
    if (!url) { setError(t('client.runtimeErrors.useAValidServerAddress')); return; }
    editing.current = false;
    Keyboard.dismiss();
    setHomeVisible(false);
    setResourceVisible(false);
    setAddress(url);
    setError(''); activity.onLoadStart();
    if (url === mappingBrowserUrl(currentUrl)) { webview.current?.reload(); return; }
    load(url);
  };
  const visit = (address: string) => {
    const url = mappingBrowserUrl(address);
    if (!url) return;
    Keyboard.dismiss(); setHomeVisible(false);
    setResourceVisible(false);
    if (url === mappingBrowserUrl(currentUrl)) { setAddress(url); return; }
    editing.current = false;
    setAddress(url); setError(''); activity.onLoadStart(); load(url);
  };
  const onNavigationStateChange = (state: WebViewNavigation) => {
    setHistory({ back: state.canGoBack, forward: state.canGoForward });
    if (!/^https?:\/\//i.test(state.url)) return;
    setCurrentUrl(state.url);
    if (!editing.current && !resourceVisible && !homeVisible) setAddress(state.url);
    setTitle(state.title);
    // Navigation reports are observations, not load requests. Replaying delayed reports through
    // source can alternate old and new pages indefinitely while a navigation is already in flight.
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
    currentUrl: homeVisible ? '' : resourceVisible ? resource!.url : currentUrl,
    title: homeVisible ? '' : resourceVisible ? resource!.title : title,
    history: homeVisible ? { back: homeReturn === 'goBack', forward: homeReturn === 'goForward' }
      : { back: true, forward: !resourceVisible ? history.forward : Boolean(currentUrl) },
    home, homeVisible, resourceVisible, resourceGeneration, error, activity,
    navigate, submit, visit, onNavigationStateChange, openExternal, onError };
}
