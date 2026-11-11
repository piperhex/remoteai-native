import type { Item, Thread, Turn } from '../conversation/types';
import type { CliEntry, CliHistory } from './types';

function item(entry: CliEntry): Item {
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

/** All engines use the same turn renderer and history navigation as the built-in GUI. */
export function cliThread(history: CliHistory | null): Thread | null {
  if (!history) return null;
  const turns: Turn[] = [];
  for (const entry of history.entries) {
    if (!entry.text && !entry.title && !entry.changes?.length && !entry.images?.length) continue;
    if (!turns.length || entry.role === 'user') turns.push({ id: entry.id, status: 'completed', items: [] });
    turns[turns.length - 1].items.push(item(entry));
  }
  if (history.session.status === 'running' && turns.length) turns[turns.length - 1].status = 'inProgress';
  return { id: history.session.id, name: history.session.title, preview: history.session.title,
    cwd: history.session.cwd, updatedAt: Date.parse(history.session.updatedAt) / 1000, turns };
}
