import { BulkError, bulkAssert } from './bulkLimits';
import type { BulkRelay } from './bulkTransport';
import { browserChatSocket, type ChatSocket } from './client/socket';

const RETRY_MS = 1000;
const CONNECT_TIMEOUT_MS = 15_000;
export type FileSocketFactory = (url: string) => ChatSocket;

/** A session capability authenticates a physically separate socket; cloud credentials never enter it. */
export class FileRelay implements BulkRelay {
  private socket?: ChatSocket;
  private ticket?: string;
  private ready = false;
  private closed = false;
  private retry?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(private readonly options: {
    url?: () => string; sessionId: string; createSocket?: FileSocketFactory;
    record: (bytes: Uint8Array) => void; changed: () => void; quota: (data: string) => void;
    fallback: BulkRelay;
  }) {}

  get independent() { return !!this.ticket; }
  available = () => this.ticket ? this.ready : this.options.fallback.available();
  configure(value: unknown) {
    if (this.closed || !value || typeof value !== 'object') return;
    const config = value as { version?: unknown; ticket?: unknown };
    if (config.version !== 1 || typeof config.ticket !== 'string' || !config.ticket || config.ticket.length > 128) return;
    if (this.ticket === config.ticket) return;
    this.ticket = config.ticket;
    this.disconnect(); this.connect();
  }
  private connect() {
    if (this.closed || !this.ticket) return;
    try {
      const url = this.options.url ? new URL(this.options.url()) : undefined;
      url?.searchParams.set('channel', 'file');
      bulkAssert(url || this.options.createSocket, 'PATH_UNAVAILABLE');
      const socket = (this.options.createSocket ?? browserChatSocket)(url?.toString() ?? '');
      this.socket = socket;
      this.timeout = setTimeout(() => this.failed(socket), CONNECT_TIMEOUT_MS);
      socket.onopen = () => {
        if (socket !== this.socket) return;
        try { socket.send(JSON.stringify({ type: 'file-relay-authenticate',
          sessionId: this.options.sessionId, ticket: this.ticket })); }
        catch { this.failed(socket); }
      };
      socket.onmessage = ({ data }) => {
        if (socket !== this.socket || typeof data !== 'string') return;
        try { this.receive(data); } catch { this.failed(socket); }
      };
      socket.onbulk = (id, bytes) => {
        if (socket !== this.socket) return;
        try { bulkAssert(this.ready && id === this.options.sessionId, 'INVALID_RECORD'); this.options.record(bytes); }
        catch { this.failed(socket); }
      };
      socket.onclose = socket.onerror = () => this.failed(socket);
    } catch { this.disconnect(); this.schedule(); }
  }
  private receive(data: string) {
    const frame = JSON.parse(data) as { type?: string; sessionId?: string };
    bulkAssert(frame.sessionId === this.options.sessionId, 'INVALID_RECORD');
    if (frame.type === 'file-relay-ready') {
      clearTimeout(this.timeout); this.ready = true; this.options.changed(); return;
    }
    if (frame.type === 'relay-quota') { this.options.quota(data); return; }
    throw new BulkError('INVALID_RECORD');
  }
  private failed(socket: ChatSocket) {
    if (this.socket !== socket) return;
    this.disconnect(); this.schedule();
  }
  private schedule() {
    clearTimeout(this.retry);
    if (!this.closed) this.retry = setTimeout(() => this.connect(), RETRY_MS);
  }
  private disconnect() {
    clearTimeout(this.retry); clearTimeout(this.timeout);
    const socket = this.socket; this.socket = undefined; this.ready = false;
    if (socket) { socket.onclose = socket.onerror = null; socket.close(); }
    this.options.changed();
  }
  send = (bytes: Uint8Array) => this.sendBatch([bytes]);
  sendBatch = async (records: readonly Uint8Array[]) => {
    if (!this.ticket) {
      if (this.options.fallback.sendBatch) return this.options.fallback.sendBatch(records);
      for (const record of records) await this.options.fallback.send(record);
      return;
    }
    const socket = this.socket;
    bulkAssert(this.ready && socket?.sendBulk, 'PATH_UNAVAILABLE');
    try { await socket.sendBulk(this.options.sessionId, records); }
    catch { this.failed(socket); throw new BulkError('PATH_UNAVAILABLE'); }
  };
  close() { if (this.closed) return; this.closed = true; this.disconnect(); }
}
