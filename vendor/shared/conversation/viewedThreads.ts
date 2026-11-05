import { invoke, isDesktopApp } from '../platform/localBackend';

const viewers = new Map<object, string>();
const fullDetails = new Set<object>();
let revision = 0;
let applied = -1;
let pending: Promise<void> | undefined;

export const viewedThreadIds = () => [...new Set(viewers.values())];

/** One serialized union per renderer; remote viewers must not replace the local selection. */
export function watchConversation(owner: object, threadId: string | null, includeDetails = false): Promise<void> {
  if (viewers.get(owner) !== (threadId ?? undefined) || fullDetails.has(owner) !== (includeDetails && !!threadId)) {
    if (threadId) viewers.set(owner, threadId);
    else viewers.delete(owner);
    if (includeDetails && threadId) fullDetails.add(owner);
    else fullDetails.delete(owner);
    revision++;
  }
  if (!isDesktopApp) return Promise.resolve();
  return synchronize();
}

function synchronize(): Promise<void> {
  if (!pending && applied !== revision) {
    pending = (async () => {
      while (applied !== revision) {
        const current = revision;
        const fullDetailThreads = [...new Set([...fullDetails].flatMap(owner => viewers.get(owner) ?? []))];
        await invoke<void>('codex_gui_watch', { threadIds: viewedThreadIds(), fullDetailThreads });
        applied = current;
      }
    })().finally(() => { pending = undefined; });
  }
  // A selection can change after the loop returns but before its finally callback runs.
  // Every waiter must include that last change, including one arriving in that microtask gap.
  return (pending ?? Promise.resolve()).then(() => applied === revision ? undefined : synchronize());
}
