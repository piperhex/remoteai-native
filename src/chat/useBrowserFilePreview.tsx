import { useContext, useEffect, useMemo, useSyncExternalStore, type ContextType } from 'react';
import type { FileReference } from '../../vendor/shared/chat/fileReference';
import { fileResourceUrl } from '../../vendor/shared/file-preview/resourceAddress';
import { previewReference } from '../../vendor/shared/file-preview/workspace/references';
import { NativeBrowserContext } from '../browser/context';
import { ChatImageContext } from './ChatImage';
import { ChatFileContext, FilePreviewContent, type ChatFileOptions } from './ChatFilePreview';

type Snapshot = { options: ChatFileOptions; images: ContextType<typeof ChatImageContext> };
function createSession(initial: Snapshot) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    snapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: (value: Snapshot) => { snapshot = value; listeners.forEach(listener => listener()); },
  };
}
type Session = ReturnType<typeof createSession>;

function BrowserFilePreview({ session, file, active, close, open }: {
  session: Session; file: FileReference; active: boolean; close: () => void; open: (file: FileReference) => void;
}) {
  const { options, images } = useSyncExternalStore(session.subscribe, session.snapshot);
  return <ChatImageContext.Provider value={images}>
    <ChatFileContext.Provider value={next => {
      const resolved = previewReference(next.path, file.path);
      open(resolved ? { ...next, path: resolved.path } : next);
    }}>
      <FilePreviewContent {...options} file={file} embedded active={active} close={close} />
    </ChatFileContext.Provider>
  </ChatImageContext.Provider>;
}

/** Keep each tab attached to its original conversation while connection readiness remains live. */
export function useBrowserFilePreview(options: ChatFileOptions) {
  const browser = useContext(NativeBrowserContext);
  const images = useContext(ChatImageContext);
  const session = useMemo(() => createSession({ options, images }), [options.threadId, options.files]);
  useEffect(() => { session.update({ options, images }); }, [session, options, images]);
  useEffect(() => () => {
    const current = session.snapshot();
    session.update({ options: { ...current.options, ready: false },
      images: current.images ? { ...current.images, ready: false } : null });
  }, [session]);
  const open = (file: FileReference) => browser?.openResource({
    title: file.path.split(/[\\/]/).at(-1) ?? file.path, url: fileResourceUrl(file.path),
    render: props => <BrowserFilePreview {...props} session={session} file={file} open={open} />,
  });
  return browser?.openResource ? open : null;
}
