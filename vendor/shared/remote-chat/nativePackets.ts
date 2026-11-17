import type { NativeChatTarget, NativeSessionCipher } from './nativeSessionCipher';
import { MAX_PACKET_PLAIN_BYTES } from './packetCompression';

const DATA_PACKETS = 64;
const CONTROL_PACKETS = 32;
// The compatible chat wire format is hex; reserve ciphertext bytes before async encryption finishes.
export const NATIVE_PACKET_WIRE_BYTES = (MAX_PACKET_PLAIN_BYTES + 12 + 16) * 2;
export function nativePacketWireBytes(text: string) {
  // A UTF-16 unit needs at most three UTF-8 bytes. Include hex expansion and the optional outer batch.
  return Math.min(NATIVE_PACKET_WIRE_BYTES, text.length * 6 + 56) + 4;
}

/** Bounded asynchronous AEAD queues reserve capacity for heartbeats and acknowledgements. */
export class NativePackets {
  private readonly sending = new Map<string, number>();
  private bytes = 0;
  private controls = 0;
  private receiving = 0;
  private closed = false;
  constructor(private readonly cipher: NativeSessionCipher, private readonly failed: () => void,
    private readonly drained: () => void, private readonly retryable = true) {}
  get bufferedAmount() { return this.bytes; }

  send(options: { key?: string; text: string; compress: boolean; write: (payload: string) => void;
    target?: NativeChatTarget; sendFailed?: () => void }) {
    if (this.closed) return false;
    const { key, text, compress, write } = options;
    if (key && this.sending.has(key)) return true;
    if (key ? this.sending.size >= DATA_PACKETS : this.controls >= CONTROL_PACKETS) return false;
    if (key) { const bytes = nativePacketWireBytes(text); this.sending.set(key, bytes); this.bytes += bytes; }
    else this.controls++;
    const direct = options.target && this.cipher.sendDirect;
    const sent = direct ? direct.call(this.cipher, options.target!, text, compress)
      : this.cipher.encrypt(text, compress).then(payload => { if (!this.closed) write(payload); });
    void sent.catch(() => {
      if (!this.closed) (direct ? options.sendFailed ?? this.failed : this.failed)();
    }).finally(() => {
        if (key) { this.bytes -= this.sending.get(key) ?? 0; this.sending.delete(key); } else this.controls--;
        if (!this.closed) this.drained();
      });
    return true;
  }

  receive(payload: string, accept: (text: string) => void) {
    if (this.closed) return;
    if (this.receiving >= DATA_PACKETS + CONTROL_PACKETS) {
      // Version 2 retransmits unacknowledged frames; legacy streams must reconnect instead of losing data silently.
      if (!this.retryable) this.failed();
      return;
    }
    this.receiving++;
    void this.cipher.decrypt(payload).then(text => { if (!this.closed && text !== null) accept(text); })
      .catch(() => { if (!this.closed) this.failed(); }).finally(() => { this.receiving--; });
  }
  close() { this.closed = true; this.sending.clear(); this.bytes = 0; }
}
