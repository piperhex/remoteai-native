import { useState } from 'react';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { PREVIEW_NETWORK_BUSY, PREVIEW_NETWORK_IDLE } from './previewNetworkActivity';

export function usePreviewActivity() {
  const [progress, setProgress] = useState<number | null>(0);
  const [requesting, setRequesting] = useState(false);
  const onLoadStart = () => { setProgress(0); setRequesting(false); };
  const onLoadProgress: NonNullable<WebViewProps['onLoadProgress']> = ({ nativeEvent: { progress } }) => {
    setProgress(current => current === null ? null : Math.max(current, progress));
  };
  const onLoadEnd = () => setProgress(null);
  const reset = () => { onLoadEnd(); setRequesting(false); };
  const onMessage = ({ nativeEvent: { data } }: WebViewMessageEvent) => {
    if (data === PREVIEW_NETWORK_BUSY) setRequesting(true);
    else if (data === PREVIEW_NETWORK_IDLE) setRequesting(false);
  };
  return { active: progress !== null || requesting, progress, onLoadStart, onLoadProgress, onLoadEnd, onMessage, reset };
}
