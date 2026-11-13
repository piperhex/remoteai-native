import { readBrowserDocument, type BrowserDocument, type BrowserReply } from './model';
type Listener = (document?: BrowserDocument) => void;

export class BrowserDataChannel {
  available = false;
  private listeners = new Set<Listener>();
  private pending = new Map<string, { resolve: (reply: BrowserReply) => void; reject: () => void }>();
  constructor(private send: (frame: Record<string, unknown>) => boolean, private randomId: () => string) {}
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  ready(available: boolean) { this.available = available; this.listeners.forEach(listener => listener()); }
  disconnect() {
    this.available = false;
    this.pending.forEach(request => request.reject()); this.pending.clear();
    this.listeners.forEach(listener => listener());
  }
  exchange = (document?: BrowserDocument): Promise<BrowserReply> => new Promise((resolve, reject) => {
    const id = this.randomId();
    const fail = () => { clearTimeout(timer); this.pending.delete(id); reject(new Error('browser-data-sync')); };
    const timer = setTimeout(fail, 12000);
    this.pending.set(id, { reject: fail, resolve: reply => {
      clearTimeout(timer); this.pending.delete(id); resolve(reply);
    } });
    if (!this.available || !this.send({ type: document ? 'browser-data-save' : 'browser-data-read', id,
      ...(document ? { browserData: document } : {}) })) fail();
  });
  receive(frame: Record<string, unknown>) {
    const pending = this.pending.get(String(frame.id));
    if (frame.type === 'rejected' && pending) { pending.reject(); return true; }
    if (frame.type !== 'browser-data') return false;
    const document = readBrowserDocument(frame.document);
    if (!document) { pending?.reject(); return true; }
    if (pending) pending.resolve({ document, accepted: frame.accepted === true });
    else this.listeners.forEach(listener => listener(document));
    return true;
  }
}
