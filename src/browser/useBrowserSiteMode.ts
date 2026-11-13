import { useEffect, useRef, useState, type RefObject } from 'react';
import { useWindowDimensions } from 'react-native';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import { BROWSER_USER_AGENT_MESSAGE, BROWSER_USER_AGENT_SCRIPT, desktopViewportScript,
  desktopUserAgent } from './browserSiteMode';

let defaultUserAgent: string | undefined;

export function useBrowserSiteMode(desktop: boolean, webview: RefObject<WebView | null>) {
  const { width } = useWindowDimensions();
  const [original, setOriginal] = useState(defaultUserAgent);
  const userAgent = desktop && original ? desktopUserAgent(original) : undefined;
  const previous = useRef({ desktop, userAgent });
  useEffect(() => {
    if (previous.current.desktop !== desktop || previous.current.userAgent !== userAgent) webview.current?.reload();
    previous.current = { desktop, userAgent };
  }, [desktop, userAgent, webview]);
  const receive = (event: WebViewMessageEvent) => {
    try {
      const value = JSON.parse(event.nativeEvent.data);
      if (value.type !== BROWSER_USER_AGENT_MESSAGE) return false;
      if (!original && typeof value.userAgent === 'string' && value.userAgent.length <= 1024) {
        defaultUserAgent = value.userAgent; setOriginal(value.userAgent);
      }
      return true;
    } catch { return false; }
  };
  return { userAgent, receive, script: BROWSER_USER_AGENT_SCRIPT + (desktop ? desktopViewportScript(width) : '') };
}
