import type { Thread } from '../../conversation/types';
import { emptySidebar, type SidebarSnapshot, type SidebarThread, type ThreadReadReceipt } from '../../remote-chat/sidebar';
import { emptyGrouping, type ChatGroup } from '../groups/model';
import { threadSummary } from './summary';

export interface DirectoryQuery { archived: boolean; search: string; groupId?: string }
export type ChatDirectoryEntry =
  | { key: '@metadata'; kind: 'metadata'; revision: number }
  | { key: string; kind: 'thread'; value: Thread }
  | { key: string; kind: 'presentation'; id: string; value: SidebarThread }
  | { key: string; kind: 'read'; id: string; value: ThreadReadReceipt }
  | { key: string; kind: 'pin' | 'projectPin'; id: string; value: number }
  | { key: string; kind: 'group'; id: string; value: ChatGroup }
  | { key: string; kind: 'groupThread' | 'groupProject'; id: string; value: string | null }
  | { key: '@page'; kind: 'page'; cursor: string | null; complete: boolean };

export const directoryScope = (query: DirectoryQuery) => JSON.stringify(['codex', query.archived,
  query.search, query.groupId ?? null]);
export const summaryEntry = (thread: Thread): ChatDirectoryEntry =>
  ({ key: `thread:${thread.id}`, kind: 'thread', value: threadSummary(thread) });

export function readDirectoryQuery(input: unknown): DirectoryQuery {
  if (!input || typeof input !== 'object') throw new Error('Invalid request');
  const query = input as DirectoryQuery;
  if (typeof query.archived !== 'boolean' || typeof query.search !== 'string' || query.search.length > 1000
    || (query.groupId !== undefined && (typeof query.groupId !== 'string' || query.groupId.length > 200))) {
    throw new Error('Invalid request');
  }
  return { archived: query.archived, search: query.search, ...(query.groupId ? { groupId: query.groupId } : {}) };
}

/** Per-thread metadata is independent of global group definitions and pin order. */
export function sidebarThreadEntries(sidebar: SidebarSnapshot, id: string): ChatDirectoryEntry[] {
  const entries: ChatDirectoryEntry[] = [];
  if (sidebar.threads[id]) entries.push({ key: `presentation:${id}`, kind: 'presentation', id,
    value: sidebar.threads[id] });
  if (sidebar.readState[id]) entries.push({ key: `read:${id}`, kind: 'read', id, value: sidebar.readState[id] });
  if (sidebar.grouping && Object.hasOwn(sidebar.grouping.threads, id)) {
    entries.push({ key: `groupThread:${id}`, kind: 'groupThread', id, value: sidebar.grouping.threads[id] });
  }
  return entries;
}

export function sidebarEntries(sidebar: SidebarSnapshot, ids: Set<string>, icon: (source: string) => string) {
  const entries: ChatDirectoryEntry[] = [{ key: '@metadata', kind: 'metadata', revision: sidebar.revision }];
  for (const id of ids) entries.push(...sidebarThreadEntries(sidebar, id));
  sidebar.pins?.forEach((id, value) => entries.push({ key: `pin:${id}`, kind: 'pin', id, value }));
  sidebar.pinnedProjects?.forEach((id, value) => entries.push({ key: `projectPin:${id}`, kind: 'projectPin', id, value }));
  for (const group of sidebar.grouping?.groups ?? []) entries.push({ key: `group:${group.id}`, kind: 'group',
    id: group.id, value: { ...group, ...(group.icon ? { icon: icon(group.icon) } : {}) } });
  for (const [id, value] of Object.entries(sidebar.grouping?.projects ?? {})) {
    entries.push({ key: `groupProject:${id}`, kind: 'groupProject', id, value });
  }
  return entries;
}

export function projectDirectory(entries: ChatDirectoryEntry[], icon: (reference: string) => string | undefined) {
  const threads: Thread[] = [];
  const sidebar: SidebarSnapshot = { ...emptySidebar(), grouping: emptyGrouping() };
  const pins: [string, number][] = [];
  const projects: [string, number][] = [];
  let cursor: string | null = null;
  for (const entry of entries) {
    switch (entry.kind) {
      case 'metadata': sidebar.revision = entry.revision; break;
      case 'thread': threads.push(entry.value); break;
      case 'presentation': sidebar.threads[entry.id] = entry.value; break;
      case 'read': sidebar.readState[entry.id] = entry.value; break;
      case 'pin': pins.push([entry.id, entry.value]); break;
      case 'projectPin': projects.push([entry.id, entry.value]); break;
      case 'group': sidebar.grouping!.groups.push({ ...entry.value,
        icon: entry.value.icon ? icon(entry.value.icon) : undefined }); break;
      case 'groupThread': sidebar.grouping!.threads[entry.id] = entry.value; break;
      case 'groupProject': sidebar.grouping!.projects[entry.id] = entry.value; break;
      case 'page': cursor = entry.cursor; break;
    }
  }
  sidebar.pins = pins.sort((a, b) => a[1] - b[1]).map(([id]) => id);
  sidebar.pinnedProjects = projects.sort((a, b) => a[1] - b[1]).map(([id]) => id);
  threads.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  return { threads, sidebar, cursor };
}

export function validChatDirectoryEntry(value: unknown): value is ChatDirectoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as ChatDirectoryEntry;
  if (typeof entry.key !== 'string') return false;
  if (entry.kind === 'metadata') return entry.key === '@metadata' && Number.isSafeInteger(entry.revision);
  if (entry.kind === 'page') return entry.key === '@page' && typeof entry.complete === 'boolean'
    && (entry.cursor === null || typeof entry.cursor === 'string');
  if (!('value' in entry)) return false;
  if (entry.kind === 'thread') return !!entry.value && typeof entry.value.id === 'string'
    && entry.key === `thread:${entry.value.id}` && typeof entry.value.cwd === 'string'
    && typeof entry.value.preview === 'string' && Number.isFinite(entry.value.updatedAt) && !entry.value.turns;
  if (!('id' in entry) || typeof entry.id !== 'string' || entry.key !== `${entry.kind}:${entry.id}`) return false;
  if (entry.kind === 'groupThread' || entry.kind === 'groupProject') {
    return entry.value === null || typeof entry.value === 'string';
  }
  if (entry.kind === 'pin' || entry.kind === 'projectPin') return Number.isSafeInteger(entry.value);
  if (entry.kind === 'read') return !!entry.value && typeof entry.value.turnId === 'string'
    && typeof entry.value.unread === 'boolean';
  if (entry.kind === 'presentation') return !!entry.value && typeof entry.value.cwd === 'string'
    && typeof entry.value.title === 'string' && typeof entry.value.projectName === 'string'
    && typeof entry.value.running === 'boolean';
  return entry.kind === 'group' && !!entry.value && entry.value.id === entry.id
    && typeof entry.value.name === 'string' && (entry.value.parentId === null || typeof entry.value.parentId === 'string')
    && (entry.value.icon === undefined || typeof entry.value.icon === 'string');
}
