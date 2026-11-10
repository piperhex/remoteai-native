import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { checkPreviewSize, previewByteLimit, type PreviewLoader } from './kinds';
import { subscribeChatPolicy } from '../remote-chat/policy';
import type { ProjectDocument } from '../project-browser/protocol';

export function usePreviewFile(options: {
  load: PreviewLoader; document: ProjectDocument; connected: boolean; enabled: boolean;
}) {
  const { load, document, connected, enabled } = options;
  const [file, setFile] = useState<Blob>();
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const loaded = useRef<{ document: ProjectDocument; file: Blob }>();
  const limit = useSyncExternalStore(subscribeChatPolicy, () => previewByteLimit(document.path, load.mode));
  useEffect(() => {
    setError(''); setProgress(0);
    setFile(undefined);
    if (!enabled) return;
    if (!connected) { setError('client.projectBrowser.disconnectedReconnectToContinue'); return; }
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      checkPreviewSize(document.size, document.path, load.mode);
      if (loaded.current?.document === document) return loaded.current.file;
      return load(document.path, { signal: controller.signal,
        progress: (received, total) => {
          if (!controller.signal.aborted) setProgress(total ? Math.round(received / total * 100) : 0);
        } });
    }).then(value => {
      checkPreviewSize(value.size, document.path, load.mode);
      if (!controller.signal.aborted) { loaded.current = { document, file: value }; setFile(value); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error && cause.message === 'client.filePreview.tooLarge'
        ? cause.message : 'client.filePreview.unavailable');
    });
    return () => controller.abort();
  }, [document, load, connected, enabled, limit]);
  return { file, error, progress };
}
