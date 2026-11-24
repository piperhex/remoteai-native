import { HISTORY_CONTENT_CHARS, HISTORY_ENTRY_LIMIT, historyChars, historyPreview, TOOL_PREVIEW_CHARS }
  from '../../chat/historyBudget';
import { summarizeTool } from '../../conversation/toolDetails';
import type { Item, Thread, Turn } from './types';
import type { HistoryPage } from '../historyPage';

function previewItem(item: Item, threadId: string, turnId: string): Item {
  const size = historyChars(item);
  if (size <= TOOL_PREVIEW_CHARS) return item;
  const tool = summarizeTool(item, threadId, turnId);
  if (tool !== item && historyChars(tool) <= TOOL_PREVIEW_CHARS) return tool;
  if (size <= HISTORY_CONTENT_CHARS / 2) return item;
  const content = item.content?.[0];
  const text = item.text ?? item.summary?.[0] ?? (typeof content === 'string' ? content : content?.text) ?? '…';
  return { id: item.id, type: item.type, status: item.status, phase: item.phase,
    text: historyPreview(text), ...(item.type === 'reasoning' && { summary: [historyPreview(text)] }),
    deferredBody: true, detailsRef: { threadId, turnId, itemId: item.id } };
}

function previewTurn(turn: Turn): Turn {
  if (historyChars({ ...turn, items: undefined }) <= HISTORY_CONTENT_CHARS / 4) return turn;
  const trimDiff = historyChars(turn.diff) > TOOL_PREVIEW_CHARS;
  const trimEdits = historyChars(turn.reviewEdits) > TOOL_PREVIEW_CHARS;
  return { ...turn, diff: trimDiff ? undefined : turn.diff, reviewEdits: trimEdits ? [] : turn.reviewEdits,
    reviewIncomplete: turn.reviewIncomplete || (!turn.reviewDeferred && (trimDiff || trimEdits)),
    planExplanation: turn.planExplanation && historyPreview(turn.planExplanation),
    plan: historyChars(turn.plan) <= TOOL_PREVIEW_CHARS ? turn.plan : undefined,
    error: historyChars(turn.error) <= TOOL_PREVIEW_CHARS ? turn.error : undefined,
    retryError: historyChars(turn.retryError) <= TOOL_PREVIEW_CHARS ? turn.retryError : undefined,
    requestErrors: historyChars(turn.requestErrors) <= TOOL_PREVIEW_CHARS ? turn.requestErrors : undefined };
}

// Keep the newest records for live state and the oldest records for an explicitly requested reading window.
export function residentHistory(thread: Thread, older = false) {
  const header = { ...thread, turns: undefined };
  if (historyChars(header) > HISTORY_CONTENT_CHARS / 4) {
    thread = { ...thread, preview: historyPreview(thread.preview), name: thread.name && historyPreview(thread.name) };
  }
  const source = thread.turns ?? [];
  const turns: Turn[] = [];
  let entries = 0;
  let chars = historyChars({ ...thread, turns: undefined });
  let changed = false;
  let cut = false;
  const step = older ? 1 : -1;
  for (let t = older ? 0 : source.length - 1; t >= 0 && t < source.length && !cut; t += step) {
    // Empty lifecycle turns have no item cursor. Keep the last one for read receipts, and keep room for messages.
    if (!source[t].items.length && t !== source.length - 1 && source.length > HISTORY_ENTRY_LIMIT) {
      changed = true; continue;
    }
    const turn = previewTurn(source[t]);
    changed ||= turn !== source[t];
    const metadata = historyChars({ ...turn, items: undefined });
    if (entries && (entries >= HISTORY_ENTRY_LIMIT || chars + metadata > HISTORY_CONTENT_CHARS)) { cut = true; break; }
    chars += metadata;
    if (!turn.items.length) entries++;
    const items = [];
    let projected = false;
    for (let i = older ? 0 : turn.items.length - 1; i >= 0 && i < turn.items.length; i += step) {
      const original = turn.items[i];
      const item = previewItem(original, thread.id, turn.id);
      const size = historyChars(item);
      if (entries && (entries >= HISTORY_ENTRY_LIMIT || chars + size > HISTORY_CONTENT_CHARS)) { cut = true; break; }
      chars += size;
      entries++;
      items.push(item);
      projected ||= item !== original;
    }
    if (!items.length && turn.items.length) break;
    if (!older) items.reverse();
    changed ||= projected || cut;
    turns.push(projected || cut ? { ...turn, items } : turn);
  }
  if (!older) turns.reverse();
  return { thread: changed || cut ? { ...thread, turns } : thread, cut };
}

export function residentPage(thread: Thread, hasMore: boolean): HistoryPage {
  const first = thread.turns?.find(turn => turn.items.length);
  return { hasMore: Boolean(hasMore && first), start: first ? { turnId: first.id, itemId: first.items[0].id } : undefined };
}
