import { historyKey } from './archive';
import type { LoungeMessage } from './types';

export interface GroupReadViewing { thread: boolean; history: boolean }
export interface GroupReadVisibility { message: LoungeMessage; visible: boolean; history?: boolean }

/** Visibility is measured by each host; hidden windows and covered threads never acknowledge new reads. */
export class LoungeGroupReadViewport {
  private viewing: GroupReadViewing = { thread: false, history: false };
  private visible = new Map<string, { message: LoungeMessage; history: boolean }>();
  private overlays = new Set<string>();
  constructor(private readonly host: { enabled: () => boolean; read: (messages: LoungeMessage[]) => void }) {}
  clear() { this.visible.clear(); this.overlays.clear(); }
  setViewing(viewing: GroupReadViewing) { this.viewing = viewing; this.refresh(); }
  overlay(key: string, blocked: boolean) {
    if (blocked) this.overlays.add(key); else this.overlays.delete(key);
    this.refresh();
  }
  observe({ message, visible, history = false }: GroupReadVisibility) {
    const key = `${history ? 'history' : 'thread'}:${historyKey(message)}`;
    if (visible && !message.recipient && message.groupReceipt) this.visible.set(key, { message, history });
    else this.visible.delete(key);
    this.refresh();
  }
  readable(message: LoungeMessage) {
    if (!this.host.enabled() || this.overlays.size) return false;
    const key = historyKey(message);
    return [...this.visible.values()].some(item => historyKey(item.message) === key
      && (item.history ? this.viewing.history : this.viewing.thread));
  }
  refresh() {
    this.host.read([...this.visible.values()].map(item => item.message).filter(item => this.readable(item)));
  }
}
