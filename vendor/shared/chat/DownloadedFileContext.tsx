import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { AttachmentReference } from '../conversation/attachmentTypes';
import { remoteAttachments } from '../remote-chat/composerAttachments';
import { UploadPolicyError } from '../remote-chat/policy';
import type { ConnectionMode } from '../remote-chat/protocol';

type AddFile = (file: AttachmentReference, mode: ConnectionMode) => void;
interface Receiver { mode: ConnectionMode; add: AddFile }
const Context = createContext<{ current: Receiver | null } | null>(null);
const unavailable = 'client.projectBrowser.unableToAddTheReferenceCheckThatChatIsAvailable';

export function downloadedFileReferenceError(cause: unknown) {
  if (cause instanceof UploadPolicyError) return cause.message;
  return cause instanceof Error && cause.message === unavailable ? unavailable
    : 'client.chat.couldNotAddTheFilePleaseChooseItAgain';
}

export function appendDownloadedFile(existing: AttachmentReference[], file: AttachmentReference, mode: ConnectionMode) {
  const next = [...existing.filter(entry => !(entry.name === file.name && entry.data === file.data)), file];
  remoteAttachments(next, mode);
  return next;
}

export function DownloadedFileProvider({ children, owner }: { children: ReactNode; owner: string }) {
  const target = useMemo(() => ({ current: null as Receiver | null }), [owner]);
  return <Context.Provider value={target}>{children}</Context.Provider>;
}

export function useDownloadedFileReceiver({ mode, scope, add }: {
  mode?: ConnectionMode; scope: string; add: AddFile;
}) {
  const target = useContext(Context);
  const latest = useRef(add);
  useLayoutEffect(() => { latest.current = add; }, [add]);
  useLayoutEffect(() => {
    if (!target || !mode) return;
    const receiver: Receiver = { mode, add: (file, mode) => latest.current(file, mode) };
    target.current = receiver;
    return () => { if (target.current === receiver) target.current = null; };
  }, [target, mode, scope]);
}

export function useReferenceDownloadedFile() {
  const target = useContext(Context);
  return async (load: (mode: ConnectionMode) => Promise<AttachmentReference>) => {
    const receiver = target?.current;
    if (!receiver) throw new Error(unavailable);
    const file = await load(receiver.mode);
    if (target.current !== receiver) throw new Error(unavailable);
    receiver.add(file, receiver.mode);
  };
}
