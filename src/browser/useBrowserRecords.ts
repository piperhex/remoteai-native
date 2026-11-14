import { useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, NativeModules } from 'react-native';
import type { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useBrowserData } from '../../vendor/shared/browser/data/context';
import { newDataId, validateLogin } from '../../vendor/shared/browser/data/crypto';
import { browserUrl, loginOrigin, type Login } from '../../vendor/shared/browser/data/model';
import { passwordScript } from '../../vendor/shared/browser/data/passwordScript';
import type { DataControls } from '../../vendor/shared/browser/data/clear';
import { NativeBrowserContext } from './context';
import { isPasswordFocus, matchingPasswords, type PasswordFocus } from '../../vendor/shared/browser/data/passwordFocus';

interface SiteDataBridge { clear: (cookies: boolean, cache: boolean) => Promise<void> }
const bridge = NativeModules.BrowserData as SiteDataBridge | undefined;
export function useNativeBrowserRecords(webview: RefObject<WebView | null>, visible: boolean) {
  const { store, vault, random } = useBrowserData(), browser = useContext(NativeBrowserContext);
  const previous = useRef(''), current = useRef(''), [candidate, setCandidate] = useState<Login>();
  const [focus, setFocus] = useState<PasswordFocus>();
  const pendingFill = useRef<{ id: string; resolve: () => void; reject: () => void } | undefined>(undefined);
  const closeCapture = useCallback(() => setCandidate(undefined), []);
  const closeSuggestions = useCallback(() => setFocus(undefined), []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { closeCapture(); closeSuggestions(); }
    });
    return () => { subscription.remove(); pendingFill.current?.reject(); };
  }, [closeCapture, closeSuggestions]);
  useEffect(() => { if (!visible) { closeCapture(); closeSuggestions(); } }, [visible, closeCapture, closeSuggestions]);
  const navigate = (state: WebViewNavigation) => {
    if (current.current !== state.url) { closeSuggestions(); pendingFill.current?.reject(); pendingFill.current = undefined; }
    current.current = state.url;
    if (state.loading || !browserUrl(state.url) || previous.current === state.url) return;
    previous.current = state.url;
    try { store.visit({ id: newDataId(random), kind: 'visit', url: state.url,
      title: state.title.slice(0, 512), at: Date.now() }); }
    catch { /* Persistence errors remain visible in the data manager. */ }
  };
  const receive = (event: WebViewMessageEvent) => {
    try {
      if (event.nativeEvent.data.length > 20000) return false;
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'browser-login-focus') {
        if (!visible || !isPasswordFocus(message.focus) || !vault.header()
          || message.focus.origin !== loginOrigin(event.nativeEvent.url)) return true;
        const passwords = vault.snapshot();
        if (!passwords.unlocked || matchingPasswords(passwords.entries, message.focus).length) setFocus(message.focus);
        return true;
      }
      if (message.type === 'browser-fill') {
        const pending = pendingFill.current;
        if (!pending || message.id !== pending.id) return true;
        if (message.ok === true) pending.resolve(); else pending.reject();
        pendingFill.current = undefined; return true;
      }
      if (message.type !== 'browser-login') return false;
      if (!visible || !validateLogin(message.login) || message.login.origin !== loginOrigin(event.nativeEvent.url)) return true;
      const existing = vault.snapshot().entries.find(entry => entry.origin === message.login.origin
        && entry.username === message.login.username && entry.password === message.login.password);
      if (!existing) setCandidate(message.login);
      return true;
    } catch { return false; }
  };
  const fill = (login: Login, focusId?: string) => new Promise<void>((resolve, reject) => {
    if (login.origin !== loginOrigin(current.current) || !webview.current) { reject(new Error('password-origin')); return; }
    pendingFill.current?.reject();
    const id = newDataId(random), timer = setTimeout(() => {
      if (pendingFill.current?.id === id) pendingFill.current = undefined;
      reject(new Error('password-fill'));
    }, 5000);
    pendingFill.current = { id, resolve: () => { clearTimeout(timer); resolve(); },
      reject: () => { clearTimeout(timer); reject(new Error('password-fill')); } };
    const script = passwordScript({ action: 'fill', login, focusId });
    webview.current.injectJavaScript(`(()=>{const ok=${script};
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'browser-fill',id:${JSON.stringify(id)},ok}));})();true;`);
  });
  const controls: DataControls = { tabs: browser?.tabs ?? [], closeTabs: ids => browser?.closeTabs?.(ids),
    clearSiteData: bridge ? async options => {
      await bridge.clear(options.cookies, options.cache); browser?.reloadTabs?.();
    } : undefined };
  return { navigate, receive, fill, controls, candidate, closeCapture, focus, closeSuggestions,
    script: passwordScript({ action: 'install', native: true }) + ';true;' };
}
