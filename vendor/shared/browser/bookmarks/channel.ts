import { readBookmarkDocument, type BookmarkDocument, type BookmarkReply } from './model';

const REQUEST_TIMEOUT_MS = 12_000;
type Listener = (document?: BookmarkDocument) => void;

/** Bookmark RPC shares the account socket; readiness is negotiated for older servers. */
export class BookmarkChannel {
  available = false;
  private listeners = new Set<Listener>();
  private pending = new Map<string, { resolve: (reply: BookmarkReply) => void; reject: () => void }>();
  constructor(private readonly send: (frame: Record<string, unknown>) => boolean,
    private readonly randomId: () => string = () => crypto.randomUUID()) {}
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  ready(available: boolean) {
    this.available = available;
    this.listeners.forEach(listener => listener());
  }
  disconnect() {
    this.available = false;
    this.pending.forEach(request => request.reject()); this.pending.clear();
    this.listeners.forEach(listener => listener());
  }
  exchange = (document?: BookmarkDocument): Promise<BookmarkReply> => new Promise((resolve, reject) => {
    const id = this.randomId();
    const fail = () => { clearTimeout(timer); this.pending.delete(id); reject(new Error('market.bookmarkSyncFailed')); };
    const timer = setTimeout(fail, REQUEST_TIMEOUT_MS);
    this.pending.set(id, { reject: fail, resolve: reply => {
      clearTimeout(timer); this.pending.delete(id); resolve(reply);
    } });
    if (!this.available || !this.send({ type: document ? 'bookmarks-save' : 'bookmarks-read', id,
      ...(document ? { bookmarks: document } : {}) })) fail();
  });
  receive(frame: Record<string, unknown>): boolean {
    const pending = this.pending.get(String(frame.id));
    if (frame.type === 'rejected' && pending) { pending.reject(); return true; }
    if (frame.type !== 'bookmarks') return false;
    const document = readBookmarkDocument(frame.document);
    if (!document) { pending?.reject(); return true; }
    if (pending) pending.resolve({ document, accepted: frame.accepted === true });
    else this.listeners.forEach(listener => listener(document));
    return true;
  }
}
