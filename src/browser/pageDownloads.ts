import { byteLength } from 'base64-js';
import type { BrowserExport, BrowserExportMetadata } from '../downloads/browserExport';
import { PAGE_DOWNLOAD_CHUNK_BYTES, PAGE_DOWNLOAD_PREFIX } from './pageDownloadScript';

const MAX_MESSAGE_LENGTH = PAGE_DOWNLOAD_CHUNK_BYTES * 4 / 3 + 1024;
const IDLE_TIMEOUT_MS = 40_000;

export interface PageDownloadHandlers {
  begin: (metadata: BrowserExportMetadata) => Promise<BrowserExport>;
  finished: () => void;
  failed: () => void;
}

type Packet = { id: string; action: 'finish' } | { id: string; action: 'abort' }
  | { id: string; action: 'start'; name: string; mimeType: string; size: number }
  | { id: string; action: 'write'; offset: number; data: string };

interface Flight {
  file: Promise<BrowserExport>;
  pending?: Promise<void>;
  timeout?: ReturnType<typeof setTimeout>;
}

function parsePacket(raw: string): Packet | undefined {
  if (raw.length > MAX_MESSAGE_LENGTH) return;
  let value: Record<string, unknown>;
  try { value = JSON.parse(raw.slice(PAGE_DOWNLOAD_PREFIX.length)); } catch { return; }
  if (!value || typeof value.id !== 'string' || !/^[a-z0-9-]{1,32}$/.test(value.id)) return;
  const { id, action } = value;
  if (action === 'finish') return { id, action };
  if (action === 'abort') return { id, action };
  if (action === 'start' && typeof value.name === 'string' && typeof value.mimeType === 'string'
    && typeof value.size === 'number' && Number.isSafeInteger(value.size) && value.size >= 0) {
    return { id, action, name: value.name, mimeType: value.mimeType, size: value.size };
  }
  if (action === 'write' && typeof value.offset === 'number' && Number.isSafeInteger(value.offset) && value.offset >= 0
    && typeof value.data === 'string' && value.data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) {
    return { id, action, offset: value.offset, data: value.data };
  }
}

export class PageDownloads {
  private flights = new Map<string, Flight>();

  receive(raw: string, pageUrl: string, handlers: PageDownloadHandlers, acknowledge: (id: string, ok: boolean) => void) {
    if (!raw.startsWith(PAGE_DOWNLOAD_PREFIX)) return false;
    const packet = parsePacket(raw);
    if (!packet || !/^https?:\/\//i.test(pageUrl)) return true;
    if (packet.action === 'abort') {
      if (this.flights.has(packet.id)) this.discard(packet.id);
      handlers.failed();
    } else {
      this.advance({ packet, pageUrl, handlers, acknowledge });
    }
    return true;
  }

  private advance({ packet, pageUrl, handlers, acknowledge }: {
    packet: Exclude<Packet, { action: 'abort' }>; pageUrl: string; handlers: PageDownloadHandlers;
    acknowledge: (id: string, ok: boolean) => void;
  }) {
    const { id, action } = packet;
    let flight = this.flights.get(id);
    if (action === 'start') {
      if (flight) return;
      flight = { file: handlers.begin({ pageUrl, name: packet.name, mimeType: packet.mimeType, size: packet.size }) };
      this.flights.set(id, flight);
    }
    if (!flight || flight.pending) return;
    clearTimeout(flight.timeout);
    const current = flight;
    current.pending = current.file.then(async file => {
      if (this.flights.get(id) !== current) return;
      if (action === 'write') {
        const bytes = byteLength(packet.data);
        if (bytes > PAGE_DOWNLOAD_CHUNK_BYTES) throw new Error('Invalid browser download packet');
        await file.write(packet.offset, packet.data, bytes);
      } else if (action === 'finish') {
        await file.finish();
      }
    }).then(() => {
      current.pending = undefined;
      if (this.flights.get(id) !== current) return;
      if (action === 'finish') { this.flights.delete(id); handlers.finished(); }
      else current.timeout = setTimeout(() => this.discard(id), IDLE_TIMEOUT_MS);
      acknowledge(id, true);
    }).catch(() => {
      current.pending = undefined;
      if (this.flights.get(id) === current) { this.discard(id); acknowledge(id, false); }
    });
  }

  reset() { this.flights.forEach((_flight, id) => this.discard(id)); }

  private discard(id: string) {
    const flight = this.flights.get(id);
    if (!flight) return;
    this.flights.delete(id);
    clearTimeout(flight.timeout);
    void Promise.resolve(flight.pending).then(() => flight.file).then(file => file.discard())
      .catch(() => console.warn('Could not clean up an incomplete browser download.'));
  }
}
