import { getChatPolicy } from './policy';
import type { Thread } from './client/types';
import type { HistoryDelta } from './historySync';
import { groupTurnItems } from '../chat/turnGroups';
import { summarizeProcesses } from '../conversation/processDetails';

export const HISTORY_PAGE_SIZE = 10;
export interface HistoryCursor { turnId: string; itemId: string }
export interface HistoryWindow { start?: HistoryCursor; older?: boolean; deferProcesses?: boolean }
export interface HistoryPage { start?: HistoryCursor; hasMore: boolean }
export type PagedHistoryDelta = HistoryDelta & { page?: HistoryPage };

function validCursor(value: unknown): value is HistoryCursor {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as Partial<HistoryCursor>;
  return [cursor.turnId, cursor.itemId].every((id) => typeof id === 'string' && id.length > 0 && id.length <= 256);
}

export function parseHistoryWindow(value: unknown): HistoryWindow {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object') throw new Error('聊天记录已更新，请重新打开聊天。');
  const window = value as HistoryWindow;
  if ((window.start !== undefined && !validCursor(window.start))
    || (window.deferProcesses !== undefined && typeof window.deferProcesses !== 'boolean')
    || (window.older !== undefined && typeof window.older !== 'boolean')) {
    throw new Error('聊天记录已更新，请重新打开聊天。');
  }
  return window;
}

/** The cursor names an item, so new replies cannot shift the older-message boundary. */
export function sliceHistory(thread: Thread, window: HistoryWindow = {}): { thread: Thread; page: HistoryPage } {
  if (window.deferProcesses) thread = summarizeProcesses(thread);
  const turns = thread.turns ?? [];
  const pages = turns.map(turn => window.deferProcesses ? groupTurnItems(turn.items).map(group => group.items)
    : turn.items.map(item => [item]));
  let count = 0;
  let anchor = -1;
  for (const [position, turn] of turns.entries()) {
    const index = turn.id === window.start?.turnId
      ? pages[position].findIndex(group => group.some(item => item.id === window.start?.itemId)) : -1;
    if (index >= 0) anchor = count + index;
    count += pages[position].length;
  }
  const pageSize = getChatPolicy().historyPageSize;
  const start = anchor < 0 ? Math.max(0, count - pageSize)
    : Math.max(0, anchor - (window.older ? pageSize : 0));
  let offset = 0;
  const selected = turns.flatMap((turn, index) => {
    const from = Math.max(0, start - offset);
    offset += pages[index].length;
    // Trailing empty turns still carry processing, completion and read-receipt state.
    return offset > start || (offset === count && turn.items.length === 0)
      ? [{ ...turn, items: pages[index].slice(from).flat() }] : [];
  });
  const first = selected.find((turn) => turn.items.length > 0);
  return { thread: { ...thread, turns: selected }, page: { hasMore: start > 0,
    start: first ? { turnId: first.id, itemId: first.items[0].id } : undefined } };
}
