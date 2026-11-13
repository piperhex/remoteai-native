import { displayError } from '../i18n/index';
import { t, useLanguage } from '../i18n';
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Text } from 'react-native';
import type { FileReference } from '../../vendor/shared/chat/fileReference';
import { localImageSource } from '../../vendor/shared/chat/imageSources';
import { isMarkdownPath, type TextPreview } from '../../vendor/shared/remote-chat/textPreview';
import { FilePreviewSheet, type FilePreviewAction } from './FilePreviewSheet';
import { ChatDownloadPreview } from './ChatDownloadPreview';
import { SheetScrollView } from '../components/SheetScrollView';
import { ChatCodeBlock } from './ChatCodeBlock';
import { ChatImageFilePreview } from './ChatImageFilePreview';
import { ChatHtmlPreview, isHtmlPath } from './ChatHtmlPreview';
import { ChatMarkdownPreview } from './ChatMarkdownPreview';
import { fileLanguage } from './ChatCodeHighlight';
import { useStyles } from './styles';

import { isVideoPath, type VideoClient } from '../../vendor/shared/remote-chat/video';
import { VideoViewer } from './video/VideoViewer';
import type { FileClient } from '../../vendor/shared/remote-chat/fileDownload';
import { useManagedDownload } from '../downloads/useManagedDownload';
import type { PreviewLoadOptions, PreviewProgress } from '../../vendor/shared/remote-chat/previewProgress';
import { PreviewTransferProgress } from './PreviewTransferProgress';
import { isDownloadOnlyFile } from '../../vendor/shared/remote-chat/filePreview';
import { filePreviewError } from '../../vendor/shared/remote-chat/fileErrors';
import { filePreviewKind } from '../../vendor/shared/file-preview/kinds';
import { useBrowserFilePreview } from './useBrowserFilePreview';
import { ChatBinaryFilePreview } from './ChatBinaryFilePreview';

export const ChatFileContext = createContext<((file: FileReference) => void) | null>(null);
interface Props {
  active?: boolean;
  threadId: string | null;
  ready: boolean;
  load: (threadId: string, path: string, options?: PreviewLoadOptions) => Promise<TextPreview>;
  children: ReactNode;
  videos: VideoClient;
  files: FileClient;
}

export type ChatFileOptions = Omit<Props, 'children' | 'active'>;
type PreviewProps = Omit<Props, 'children'> & {
  file: FileReference; close: () => void; embedded?: boolean;
};

function FilePreview({ file, threadId, ready, load, files, close, embedded }: PreviewProps) {
  const styles = useStyles();
  useLanguage();
  const [result, setResult] = useState<TextPreview>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<PreviewProgress>();
  const [source, setSource] = useState(false);
  const binary = isDownloadOnlyFile(file.path);
  const html = isHtmlPath(file.path);
  const markdown = isMarkdownPath(file.path);
  const sourceLabel = t(html ? 'client.downloads.source' : 'client.chat.source');
  const rendered = Boolean(result && (html || markdown));
  const download = useManagedDownload({ client: files, threadId, ready, path: file.path });
  const transferIcon = Platform.OS === 'android' ? 'pause' : 'close';
  const downloadIcon = download.completed ? 'file-outline' : 'download';
  useEffect(() => {
    if (!threadId || !ready || binary) return;
    const observer = new AbortController();
    setError(''); setResult(undefined); setProgress(undefined);
    void load(threadId, file.path, { signal: observer.signal,
      onProgress: value => { if (!observer.signal.aborted) setProgress(value); },
    }).then((value) => { if (!observer.signal.aborted) setResult(value); }, cause => {
      if (!observer.signal.aborted) setError(displayError(filePreviewError(cause, "暂时无法预览，可以下载后打开。")));
    });
    return () => { observer.abort(); };
  }, [threadId, ready, load, file.path, attempt, binary]);
  const actions: FilePreviewAction[] = [
      ...(html || markdown ? [{
        label: source ? t('client.chat.preview') : sourceLabel,
        icon: source ? 'eye-outline' as const : 'code-tags' as const,
        onPress: () => setSource(value => !value), disabled: !result,
      }] : []),
      ...(download.share ? [{ label: t("client.downloads.shareFile"), onPress: download.share, icon: 'share-variant' as const,
        loading: download.sharing, disabled: download.busy }] : []),
      { label: download.label, onPress: download.busy ? download.cancel : download.start,
        icon: download.busy ? transferIcon : downloadIcon,
        tone: 'primary',
        disabled: download.sharing || (!download.busy && !download.completed && (!ready || !threadId)) },
    ...(error ? [{ label: t("client.mobile.retryPreview"), onPress: () => setAttempt(attempt + 1),
      icon: 'reload' as const, disabled: !ready }] : [])];
  if (binary && embedded) return <FilePreviewSheet path={file.path} previewable={false} close={close} embedded actions={[]}>
    <ChatDownloadPreview path={file.path} ready={ready} actions={actions} download={download} />
  </FilePreviewSheet>;
  return <FilePreviewSheet path={file.path} previewable={!binary} close={close} embedded={embedded} actions={actions}>
    {(!rendered || download.message || download.busy && download.detail) && <SheetScrollView
      style={rendered || binary ? { flexGrow: 0, flexShrink: 1 } : { flex: 1 }}
      contentContainerStyle={{ paddingBottom: rendered ? 0 : 20 }}>
      {!ready && !result && <Text style={styles.subtitle}>{t("client.mobile.connectToYourComputerToViewTheFile")}</Text>}
      {binary && <Text style={styles.subtitle}>{t("client.mobile.downloadTheFileToOpenItInACompatibleApp")}</Text>}
      {ready && !binary && !result && !error && <PreviewTransferProgress progress={progress} label={t("client.chat.loadingFile")} />}
      {download.busy && !!download.detail && <Text style={[styles.subtitle, { maxWidth: 400 }]}>
        {download.detail}</Text>}
      {!!download.message && <Text accessibilityLiveRegion="polite" style={[styles.subtitle,
        { maxWidth: 400 }]}>{displayError(download.message)}</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {result && !html && !markdown && <>
        <Text style={styles.subtitle}>{t("client.mobile.currentFileContent")}{file.line ? t("client.mobile.referencedLine", { value1: file.line }) : ''}</Text>
        <ChatCodeBlock text={result.text} label={t("client.mobile.fullText")} language={fileLanguage(file.path)}
          lineNumbers copyLabel={t("client.chat.copyFileContents")} />
      </>}
    </SheetScrollView>}
    {result && html && <ChatHtmlPreview text={result.text} source={source}
      context={threadId ? { path: result.path, client: files, threadId } : undefined} />}
    {result && markdown && <ChatMarkdownPreview text={result.text} line={file.line} source={source} />}
  </FilePreviewSheet>;
}

export function FilePreviewContent(props: PreviewProps) {
  useLanguage();
  const { file, threadId, ready, videos, files, close, embedded, active } = props;
  const kind = filePreviewKind(file.path);
  if (localImageSource(file.path)) return <ChatImageFilePreview path={file.path}
    close={close} embedded={embedded} active={active} />;
  if (isVideoPath(file.path)) return <VideoViewer path={file.path} threadId={threadId}
    ready={ready} client={videos} files={files} close={close} embedded={embedded} active={active} />;
  if (kind === 'pdf' || kind === 'audio' || kind === 'video' || kind === 'image') return <ChatBinaryFilePreview path={file.path}
    threadId={threadId} ready={ready} files={files} close={close} embedded={embedded} active={active} />;
  return <FilePreview {...props} />;
}

export function ChatFileProvider({ children, active = true, ...options }: Props) {
  useLanguage();
  const [file, setFile] = useState<FileReference | null>(null);
  const browserPreview = useBrowserFilePreview(options);
  const open = useCallback((value: FileReference) => {
    Keyboard.dismiss();
    if (browserPreview) browserPreview(value);
    else setFile(value);
  }, [browserPreview]);
  return <ChatFileContext.Provider value={open}>
    {children}
    {active && file && <FilePreviewContent key={file.path} {...options} file={file} close={() => setFile(null)} />}
  </ChatFileContext.Provider>;
}
