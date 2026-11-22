import { HISTORY_CONTENT_CHARS, HISTORY_ENTRY_LIMIT, TOOL_PREVIEW_CHARS, historyChars, historyPreview }
  from '../chat/historyBudget';
import type { CliEntry, CliHistory } from './types';

export function sameHistory(previous: CliHistory, next: CliHistory) {
  return previous.session.id === next.session.id && previous.session.engine === next.session.engine
    && previous.cursor?.epoch === next.cursor?.epoch;
}

export function mergeEntries(older: CliEntry[], newer: CliEntry[]) {
  const boundary = newer[0]?.first ?? Infinity;
  return [...older.filter(entry => entry.last < boundary), ...newer];
}

export function cliEntryPreview(entry: CliEntry, epoch?: string): CliEntry {
  if (entry.detailCursor || historyChars(entry) <= (entry.role === 'tool' ? TOOL_PREVIEW_CHARS : HISTORY_CONTENT_CHARS / 2)) {
    return entry;
  }
  // A before-cursor is exclusive. An exact epoch check rejects a replacement replay after reconnect.
  return { id: entry.id, first: entry.first, last: entry.last, role: entry.role,
    title: entry.title && historyPreview(entry.title), status: entry.status, text: historyPreview(entry.text || '…'),
    detailCursor: { epoch: epoch ?? '', seq: entry.last + 1 } };
}

export function boundedCliHistory(history: CliHistory, older = false) {
  const source = history.entries;
  const entries: CliEntry[] = [];
  let chars = 0;
  const step = older ? 1 : -1;
  for (let i = older ? 0 : source.length - 1; i >= 0 && i < source.length; i += step) {
    const entry = cliEntryPreview(source[i], history.cursor?.epoch);
    const size = historyChars(entry);
    if (entries.length && (entries.length >= HISTORY_ENTRY_LIMIT || chars + size > HISTORY_CONTENT_CHARS)) break;
    entries.push(entry);
    chars += size;
  }
  if (!older) entries.reverse();
  const cut = entries.length < source.length;
  const cursor = cut && !older && history.cursor ? { ...history.cursor, seq: entries[0].first } : history.cursor;
  return { history: { ...history, entries, cursor, hasOlder: history.hasOlder || (cut && !older) }, cut };
}

export function refreshCliHistory(previous: CliHistory | null, next: CliHistory, expanded: boolean) {
  if (!previous || !sameHistory(previous, next)) return boundedCliHistory(next).history;
  const existing = new Map(previous.entries.map(entry => [entry.first, entry]));
  const entries = next.entries.map(entry => {
    const before = existing.get(entry.first);
    if (!before || before.last !== entry.last || before.status !== entry.status || before.role !== entry.role
      || before.title !== entry.title || before.text !== entry.text || before.changes !== entry.changes
      || before.images !== entry.images) return entry;
    return before;
  });
  // Keep manually expanded pages only while they still meet the live page without a gap.
  const joined = expanded && (entries[0]?.first ?? Infinity) <= (previous.entries.at(-1)?.last ?? -1) + 1
    ? mergeEntries(previous.entries, entries) : entries;
  return boundedCliHistory(joined.length > entries.length
    ? { ...next, entries: joined, cursor: previous.cursor, hasOlder: previous.hasOlder }
    : { ...next, entries }).history;
}
