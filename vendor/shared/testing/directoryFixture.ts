import { DirectoryJournal } from '../chat/directory/journal';
import { DIRECTORY_EVENT, type DirectoryCheckpoint } from '../chat/directory/protocol';
import { directoryScope, sidebarEntries, summaryEntry, type ChatDirectoryEntry,
  type DirectoryQuery } from '../chat/directory/documents';
import { DirectoryIcons } from '../chat/directory/icons';
import type { GuiEvent, Thread } from '../conversation/types';
import type { SidebarSnapshot } from '../remote-chat/sidebar';
import type { CliDirectoryEntry, CliRequest, CliSession } from '../cli-gui/types';
import { cliKey, cliScope } from '../cli-gui/summary';
import { DEFAULT_COMPOSER } from '../remote-chat/composer';

// Synthetic data only. Used by the browser and physical-device fixtures, never application bootstrap.
export const directoryFixtureThreads: Thread[] = Array.from({ length: 1500 }, (_, index) => ({
  id: `synthetic-${String(index).padStart(4, '0')}`, name: `测试对话 ${String(index).padStart(4, '0')}`,
  preview: '', cwd: index < 1000 ? '/fixture/recent' : '/fixture/history', updatedAt: 2000 - index,
}));
export const directoryFixtureGrouping = { groups: [{ id: 'old', name: '历史分组（测试数据）', parentId: null,
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0x8AAAAASUVORK5CYII=' }],
projects: {}, threads: Object.fromEntries(directoryFixtureThreads.slice(1000).map(thread => [thread.id, 'old'])) };

export function createDirectoryFixture() {
  const rows = new Map(directoryFixtureThreads.map(thread => [thread.id, { ...thread }]));
  const views = new Map<string, { query: DirectoryQuery; loaded: number; journal: DirectoryJournal<ChatDirectoryEntry> }>();
  const cliViews = new Map<string, { rows: CliSession[]; loaded: number; journal: DirectoryJournal<CliDirectoryEntry> }>();
  const icons = new DirectoryIcons();
  let next = 0;
  let revision = 0;
  let event: (event: GuiEvent) => void = () => {};
  const metrics: { operation: string; bytes: number; summaries: number }[] = [];
  const sidebar = (): SidebarSnapshot => ({ revision, readState: {}, grouping: directoryFixtureGrouping,
    threads: Object.fromEntries([...rows.values()].map(thread => [thread.id, { cwd: thread.cwd,
      title: thread.name!, projectName: thread.cwd.split('/').at(-1)!, running: thread.status?.type === 'active' }])) });
  const matches = (query: DirectoryQuery) => [...rows.values()].filter(thread => !query.archived
    && (!query.groupId || directoryFixtureGrouping.threads[thread.id] === query.groupId)
    && (!query.search || thread.name!.includes(query.search)));
  const fill = (view: typeof views extends Map<string, infer V> ? V : never) => {
    const data = matches(view.query);
    const page = data.slice(0, view.loaded);
    view.journal.commit([...page.map(summaryEntry), ...sidebarEntries(sidebar(), new Set(page.map(row => row.id)), icons.reference),
      { key: '@page', kind: 'page', complete: view.loaded >= data.length,
        cursor: view.loaded >= data.length ? null : String(view.loaded) }]);
  };
  const request = async <T,>(method: string, value?: unknown): Promise<T> => {
    const body = value as { operation?: string; action?: string; query: DirectoryQuery;
      checkpoint?: DirectoryCheckpoint; reference: string; threadId: string; request: CliRequest };
    let result: unknown = { data: [], nextCursor: null };
    if (method === 'connect') return { protocolVersion: 1, directorySyncV1: true, approvals: [] } as T;
    if (body.operation === 'cliGui') return cliRequest<T>(body.request);
    if (body.operation === 'queueRead') return { revision: 0, threads: {} } as T;
    if (body.operation === 'models' || body.operation === 'modelsRefresh') {
      const models = [{ id: 'test', model: 'test', displayName: 'Test', defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: [{ reasoningEffort: 'medium', description: '' }] }];
      return { data: models, nextCursor: null, composer: { revision: 0,
        settings: { ...DEFAULT_COMPOSER, model: 'test' }, models } } as T;
    }
    if (body.operation === 'read') return { thread: rows.get(body.threadId) } as T;
    if (body.operation === 'chatDirectory') {
      if (body.action === 'icon') return { source: icons.get(body.reference) } as T;
      let view = body.checkpoint && views.get(body.checkpoint.stream);
      if (body.checkpoint && !view) return { kind: 'resetRequired' } as T;
      if (!view) {
        const stream = `fixture-${++next}`;
        view = { query: body.query, loaded: 50,
          journal: new DirectoryJournal({ epoch: 'fixture-host', stream, scope: directoryScope(body.query) }) };
        views.set(stream, view); fill(view);
      } else if (body.action === 'page') { view.loaded += 50; fill(view); }
      result = body.checkpoint ? view.journal.resume(body.checkpoint) : view.journal.snapshot();
    }
    metrics.push({ operation: body.operation ?? method, bytes: new TextEncoder().encode(JSON.stringify(result)).byteLength,
      summaries: result && typeof result === 'object' && 'entries' in result
        ? (result.entries as ChatDirectoryEntry[]).filter(entry => entry.kind === 'thread').length : 0 });
    return result as T;
  };
  const cliRequest = async <T,>(request: CliRequest): Promise<T> => {
    if (request.action === 'status') return { status: 'ready', version: 'fixture', directorySyncV1: true } as T;
    if (request.action !== 'syncList') return { data: [], nextCursor: null } as T;
    let view = request.checkpoint && cliViews.get(request.checkpoint.stream);
    if (request.checkpoint && !view) return { kind: 'resetRequired' } as T;
    if (!view) {
      const stream = `fixture-cli-${++next}`;
      const sessions: CliSession[] = Array.from({ length: 120 }, (_, index) => ({ id: `${request.engine}-${index}`,
        engine: request.engine, title: `${request.engine} 测试对话 ${index}`, cwd: '/fixture/engines', model: 'test',
        status: 'idle', updatedAt: '2026-11-17T00:00:00Z', archived: false, permissions: [] }));
      view = { rows: request.archived ? [] : sessions.filter(row => row.title.includes(request.search ?? '')),
        loaded: 50, journal: new DirectoryJournal({ epoch: 'fixture-cli', stream,
          scope: cliScope(request.engine, request.archived, request.search) }) };
      cliViews.set(stream, view);
    } else if (request.more) view.loaded += 50;
    view.journal.commit([...view.rows.slice(0, view.loaded).map(row => ({ key: cliKey(row), kind: 'session' as const, value: row })),
      { key: '@page', kind: 'page', cursor: view.loaded < view.rows.length ? String(view.loaded) : null,
        complete: view.loaded >= view.rows.length }]);
    return (request.checkpoint ? view.journal.resume(request.checkpoint) : view.journal.snapshot()) as T;
  };
  return { request, cliRequest, metrics, sidebar, listen: (listener: typeof event) => { event = listener; },
    rename: () => {
      const thread = rows.get('synthetic-0000')!;
      rows.set(thread.id, { ...thread, name: '改名已同步（测试）' }); revision++;
      for (const view of views.values()) {
        const before = view.journal.checkpoint(); fill(view);
        const batch = view.journal.resume(before);
        if (batch.kind === 'changes') event({ method: DIRECTORY_EVENT, params: batch as unknown as GuiEvent['params'] });
      }
    } };
}
