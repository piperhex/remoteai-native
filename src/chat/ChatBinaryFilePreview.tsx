import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { fromByteArray } from 'base64-js';
import type { FileClient } from '../../vendor/shared/remote-chat/fileDownload';
import { filePreviewKind, previewMimeType } from '../../vendor/shared/file-preview/kinds';
import { DocumentPreview } from '../components/DocumentPreview';
import { useManagedDownload } from '../downloads/useManagedDownload';
import { displayError, t, useLanguage } from '../i18n';
import { FilePreviewSheet } from './FilePreviewSheet';
import { loadBinaryPreview } from './binaryPreview';
import { useStyles } from './styles';

function MediaPreview({ bytes, path, active }: { bytes: Uint8Array; path: string; active: boolean }) {
  const webview = useRef<WebView>(null);
  const kind = filePreviewKind(path);
  const tag = kind === 'image' ? 'img' : kind === 'video' ? 'video' : 'audio';
  const mime = previewMimeType(path);
  const source = useMemo(() => ({ html: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;;'
    + ' img-src data:; media-src data:; style-src &apos;unsafe-inline&apos;">'
    + '<style>body{margin:0;display:grid;place-items:center;height:100vh;background:#171b1f}'
    + 'audio,video,img{max-width:100%;max-height:100vh}audio{width:90%}</style>'
    + `<${tag} controls playsinline src="data:${mime};base64,${fromByteArray(bytes)}"></${tag}>` }),
  [bytes, mime, tag]);
  useEffect(() => {
    if (!active) webview.current?.injectJavaScript('document.querySelectorAll("video,audio").forEach(v=>v.pause());true;');
  }, [active]);
  return <WebView ref={webview} source={source} style={{ flex: 1 }} originWhitelist={['about:blank']}
    onShouldStartLoadWithRequest={({ url }) => url === 'about:blank'}
    allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
    sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} mediaPlaybackRequiresUserAction allowsInlineMediaPlayback
    javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false} />;
}

function BinaryContent({ path, data, active }: {
  path: string; data: Awaited<ReturnType<typeof loadBinaryPreview>>; active: boolean;
}) {
  if (filePreviewKind(path) === 'pdf') return <DocumentPreview
    file={{ name: path.split(/[\\/]/).at(-1) ?? path, mime: data.mime }} bytes={data.bytes} />;
  return <MediaPreview bytes={data.bytes} path={path} active={active} />;
}

export function ChatBinaryFilePreview({ path, threadId, ready, files, close, embedded, active = true }: {
  path: string; threadId: string | null; ready: boolean; files: FileClient; close: () => void;
  embedded?: boolean; active?: boolean;
}) {
  useLanguage();
  const styles = useStyles();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadBinaryPreview>>>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const download = useManagedDownload({ client: files, threadId, ready, path });
  const status = failed ? 'client.filePreview.unavailable'
    : ready ? 'client.chat.loadingFile' : 'client.mobile.connectToYourComputerToViewTheFile';
  useEffect(() => {
    if (!threadId || !ready) return;
    const controller = new AbortController();
    setFailed(false); setProgress(0);
    void loadBinaryPreview({ client: files, threadId, path, signal: controller.signal,
      progress: (received, total) => { if (!controller.signal.aborted) setProgress(total ? received / total * 100 : 0); },
    }).then(value => { if (!controller.signal.aborted) setData(value); },
      () => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [path, threadId, ready, files, attempt]);
  return <FilePreviewSheet path={path} previewable close={close} embedded={embedded} actions={[
    ...(download.share ? [{ label: t('client.downloads.shareFile'), icon: 'share-variant' as const,
      onPress: download.share, loading: download.sharing, disabled: download.busy }] : []),
    { label: download.label, icon: 'download', onPress: download.busy ? download.cancel : download.start,
      disabled: download.sharing || (!download.busy && !download.completed && (!ready || !threadId)) },
    ...(failed ? [{ label: t('client.mobile.retryPreview'), icon: 'reload' as const,
      onPress: () => setAttempt(value => value + 1), disabled: !ready }] : []),
  ]}>
    {data ? <BinaryContent path={path} data={data} active={active} />
      : <Text style={styles.subtitle}>{t(status)}
        {ready && !failed ? ` ${Math.round(progress)}%` : ''}</Text>}
    {!!download.message && <Text style={styles.subtitle}>{displayError(download.message)}</Text>}
  </FilePreviewSheet>;
}
