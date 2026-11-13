import { DESKTOP_SITE_WIDTH } from '../../vendor/shared/browser/siteMode';

export const BROWSER_USER_AGENT_MESSAGE = 'remoteaiBrowserUserAgent';
export const BROWSER_USER_AGENT_SCRIPT = `window.ReactNativeWebView.postMessage(JSON.stringify({
  type: '${BROWSER_USER_AGENT_MESSAGE}', userAgent: navigator.userAgent })); true;`;

/** Retain the actual WebView engine/version while removing its mobile platform markers. */
export function desktopUserAgent(userAgent: string) {
  return userAgent.replace(/\([^)]*Android[^)]*\)/, '(X11; Linux x86_64)')
    .replace(/\([^)]*(?:iPhone|iPad)[^)]*\)/, '(Macintosh; Intel Mac OS X 10_15_7)')
    .replace(/\sMobile(?:\/[^\s]+)?/g, '').replace(/\sVersion\/[^\s]+/g, '');
}

export function desktopViewportScript(screenWidth: number) {
  const scale = Math.min(1, screenWidth / DESKTOP_SITE_WIDTH);
  return `(function () {
  function update() {
    if (!document.head) return;
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport';
      document.head.appendChild(viewport); }
    var content = 'width=${DESKTOP_SITE_WIDTH},initial-scale=${scale}';
    // Android preserves the old zoom on reload; constrain it for layout, then restore pinch zoom.
    var fitting = content + ',minimum-scale=${scale},maximum-scale=${scale}';
    viewport.content = fitting;
    setTimeout(function () { if (viewport.content === fitting) viewport.content = content; }, 300);
  }
  update(); document.addEventListener('DOMContentLoaded', update, { once: true });
})(); true;`;
}
