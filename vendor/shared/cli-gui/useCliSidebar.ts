import { useEffect, useMemo } from 'react';
import type { Thread } from '../conversation/types';
import { orderThreadsByActivity } from '../chat/threadOrder';
import { useCliGui } from './context';
import type { CliSession } from './types';

export function cliSidebarThread(session: CliSession): Thread {
  return { id: `cli:${session.engine}:${session.id}`, name: session.title, preview: session.title,
    cwd: session.cwd, updatedAt: Date.parse(session.updatedAt) / 1000,
    status: { type: session.status === 'running' ? 'active' : 'idle' } };
}

/** Feed CLI conversations into the host's existing project grouping, ordering and row layout. */
export function useCliSidebar({ threads, archived, query = '' }: {
  threads: Thread[]; archived: boolean; query?: string;
}) {
  const cli = useCliGui();
  const sessions = cli?.state.sessions;
  useEffect(() => { cli?.controller.filter(archived); }, [archived, cli?.controller]);
  const entries = useMemo(() => new Map((sessions ?? [])
    .filter(session => session.archived === archived
      && `${session.title} ${session.cwd}`.toLowerCase().includes(query.trim().toLowerCase()))
    .map(session => [cliSidebarThread(session).id, session])), [sessions, archived, query]);
  const combined = useMemo(() => !entries.size ? threads : orderThreadsByActivity([
    ...threads, ...Array.from(entries.values(), cliSidebarThread),
  ], { isRunning: thread => thread.status?.type === 'active' }), [threads, entries]);
  const selected = cli?.state.selected ? cliSidebarThread(cli.state.selected) : null;
  return { threads: combined, selected, session: (thread: Thread) => entries.get(thread.id) };
}
