import type { Item, Thread, Turn } from '../conversation/types';
import type { CliEntry, CliHistory } from './types';

export function cliItem(entry: CliEntry): Item {
  if (entry.role === 'user') return { id: entry.id, type: 'userMessage', content: [
    { type: 'text', text: entry.text }, ...(entry.images ?? []).map(url => ({ type: 'image', url })),
  ] };
  if (entry.role === 'reasoning') return { id: entry.id, type: 'reasoning', summary: [entry.text] };
  if (entry.role === 'tool') {
    const status = entry.status === 'running' ? 'inProgress'
      : entry.status === 'canceled' ? 'declined' : entry.status ?? 'completed';
    if (entry.changes) return { id: entry.id, type: 'fileChange', changes: entry.changes, status };
    return { id: entry.id, type: 'commandExecution', command: entry.title, aggregatedOutput: entry.text, status };
  }
  return { id: entry.id, type: 'agentMessage', text: entry.text };
}

const rendered = new WeakMap<CliEntry, Item>();
function renderedEntry(entry: CliEntry, threadId: string, turnId: string) {
  const known = rendered.get(entry);
  if (known && (!entry.detailCursor
    || (known.detailsRef?.threadId === threadId && known.detailsRef.turnId === turnId))) {
    return known;
  }
  const item = cliItem(entry);
  if (entry.detailCursor) {
    item.detailsRef = { threadId, turnId, itemId: entry.id };
    item.deferredBody = entry.role !== 'tool';
  }
  rendered.set(entry, item);
  return item;
}

/** All engines use the same turn renderer and history navigation as the built-in GUI. */
export function cliThread(history: CliHistory | null): Thread | null {
  if (!history) return null;
  const turns: Turn[] = [];
  for (const entry of history.entries) {
    if (!entry.text && !entry.title && !entry.changes?.length && !entry.images?.length) continue;
    if (!turns.length || entry.role === 'user') {
      turns.push({ id: entry.id, reviewCwd: history.session.cwd, status: 'completed', items: [] });
    }
    const turn = turns[turns.length - 1];
    turn.items.push(renderedEntry(entry, history.session.id, turn.id));
  }
  if (history.session.status === 'running' && turns.length) turns[turns.length - 1].status = 'inProgress';
  return { id: history.session.id, name: history.session.title, preview: history.session.title,
    cwd: history.session.cwd, updatedAt: Date.parse(history.session.updatedAt) / 1000, turns };
}
