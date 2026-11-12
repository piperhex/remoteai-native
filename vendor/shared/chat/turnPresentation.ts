import type { Item, Turn } from '../remote-chat/client/types';
import { changedFiles, parseDiff } from './diff';
import { followsStoppedTurn } from '../conversation/continuation';
import { turnElapsedMs } from '../conversation/turnTiming';
import { turnMessageGroups, type TurnMessageGroup } from '../conversation/turnMessageGroups';
import { processOutputs } from '../conversation/processDetails';
import type { TurnRequestError } from '../conversation/turnRequestErrors';
export { groupTurnItems } from './turnGroups';

export type MessageEntry = { id: string; kind: 'message' | 'process'; turn: Turn; item: Item };
export type WorkEntry = { id: string; kind: 'work'; turn: Turn; items: Item[]; inline: boolean; timed?: boolean };
export type TurnEntry = MessageEntry | WorkEntry | { id: string; kind: 'summary'; turn: Turn }
  | { id: string; kind: 'error'; turn: Turn; error: TurnRequestError }
  | { id: string; kind: 'duration'; turn: Turn };

// History reducers replace changed turns. Reuse unchanged turns without retaining discarded conversations.
const entryCache = new WeakMap<Turn, Map<string, TurnEntry[]>>();

/** Rejected or still-running edits are not completed file changes. A net diff takes precedence. */
export function completedTurnFiles(turn: Turn) {
  const netFiles = parseDiff(turn.diff ?? '');
  if (netFiles.length) return netFiles;
  return changedFiles(processOutputs(turn.items).filter((item) => item.type === 'fileChange'
    && !['declined', 'failed', 'inProgress'].includes(item.status ?? ''))
    .flatMap((item) => item.changes ?? []));
}

function hasSummary(turn: Turn) {
  return Boolean(turn.plan?.length || turn.diff?.trim()
    || turn.status === 'interrupted' || turn.status === 'failed' || completedTurnFiles(turn).length
    || processOutputs(turn.items).some((item) => item.type === 'imageGeneration'
      && item.status === 'completed' && !item.failure));
}

/** Stable group IDs keep open drawers and measured list cells attached during streamed updates. */
export function conversationEntries(turns: Turn[], inlineTurns: ReadonlyMap<string, boolean> = new Map()): TurnEntry[] {
  return turns.flatMap((turn, index) => {
    const inline = inlineTurns.get(turn.id) ?? ['inProgress', 'interrupted', 'failed'].includes(turn.status);
    const continuation = followsStoppedTurn(turns[index - 1]);
    const key = `${inline}:${continuation}`;
    const cached = entryCache.get(turn)?.get(key);
    if (cached) return cached;
    const entries = turnEntries(turn, { inline, continuation });
    const cache = entryCache.get(turn) ?? new Map<string, TurnEntry[]>();
    cache.set(key, entries);
    entryCache.set(turn, cache);
    return entries;
  });
}

function turnEntries(turn: Turn, { inline, continuation }: { inline: boolean; continuation: boolean }): TurnEntry[] {
  const groups = turnMessageGroups(turn, { visibleItems: turn.items, followsInterruption: continuation });
  const entries = groups.flatMap(group => groupEntries(group, turn, inline));
  if (turn.status !== 'inProgress' && turnElapsedMs(turn, 0) != null) {
    const response = entries.findIndex((entry) => entry.kind !== 'message' || entry.item.type !== 'userMessage');
    const first = entries[response];
    if (first?.kind === 'work') first.timed = true;
    else entries.splice(response < 0 ? entries.length : response, 0,
      { id: `${turn.id}:duration`, kind: 'duration', turn });
  }
  if (hasSummary(turn)) entries.push({ id: `${turn.id}:summary`, kind: 'summary', turn });
  return entries;
}

function groupEntries(group: TurnMessageGroup, turn: Turn, inline: boolean): TurnEntry[] {
  if (group.type === 'error') return [{ id: group.key, kind: 'error', turn, error: group.error }];
  if (group.type === 'message') return [{ id: `${turn.id}:message:${group.key}`,
    kind: 'message', turn, item: group.items[0] }];
  const work: WorkEntry = { id: `${turn.id}:work:${group.key}`,
    kind: 'work', turn, items: group.items, inline };
  if (!inline) return [work];
  return [work, ...group.items.map((item): MessageEntry => ({
    id: `${turn.id}:message:${item.id}`, kind: 'process', turn, item,
  }))];
}

/** Loading an earlier page can prepend activities to an already-open process group. */
export function findWorkEntry(entries: TurnEntry[], id: string): WorkEntry | undefined {
  return entries.find((entry): entry is WorkEntry => entry.kind === 'work'
    && (entry.id === id || entry.items.some((item) => `${entry.turn.id}:work:${item.id}` === id)));
}
